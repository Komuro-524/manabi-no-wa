-- Apply with old agents stopped. Existing running rows are NOT silently unlocked.
begin;
-- Fail closed if legacy overlapping B runs need operator reconciliation first.
create unique index agent_runs_one_organizer on public.agent_runs (agent)
  where agent = 'B' and status = 'running';
create unique index agent_runs_one_mirror_user on public.agent_runs (ref_id)
  where agent = 'C' and status = 'running';
create table public.agent_cron_days (
  day date primary key, run_id bigint not null references public.agent_runs(id)
);
alter table public.agent_cron_days enable row level security;
revoke all on public.agent_cron_days from anon, authenticated;
grant all on public.agent_cron_days to service_role;

create function public.start_organizer(p_model text, p_day date default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  perform pg_advisory_xact_lock(150015, 1);
  if p_day is not null and exists(select 1 from agent_cron_days where day = p_day) then return null; end if;
  insert into agent_runs(agent, trigger, model) values ('B', case when p_day is null then 'manual' else 'cron' end, p_model)
    returning id into v_id;
  if p_day is not null then insert into agent_cron_days values (p_day, v_id); end if;
  return v_id;
end $$;

-- Persisted rate limiting shared by all function instances. Failed attempts count too.
create function public.start_mirror(p_user uuid, p_model text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('mirror:' || p_user::text, 0));
  if exists(select 1 from agent_runs where agent = 'C' and ref_id = p_user::text and status = 'running') then
    raise exception 'mirror already running' using errcode = '23505';
  end if;
  if exists(select 1 from agent_runs where agent = 'C' and ref_id = p_user::text and started_at > now() - interval '5 minutes')
    or (select count(*) from agent_runs where agent = 'C' and ref_id = p_user::text and started_at > now() - interval '24 hours') >= 10 then
    raise exception 'mirror rate limited' using errcode = 'P0429';
  end if;
  insert into agent_runs(agent, trigger, ref_id, model) values ('C', 'manual', p_user::text, p_model) returning id into v_id;
  return v_id;
end $$;

alter table public.lives add column ingest_token uuid, add column ingest_lease_until timestamptz,
  add column ingest_attempts integer not null default 0;
-- Old running records may contain partially committed data: never automatically replay those.
update public.lives set ingest_status = 'needs_review' where ingest_status = 'running';

create function public.claim_recorder(p_live bigint, p_token uuid, p_model text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_live lives%rowtype; v_run bigint;
begin
  select * into v_live from lives where id = p_live for update;
  if not found or v_live.status <> 'ended' or v_live.ingest_status in ('done','needs_review','failed') then return null; end if;
  if v_live.ingest_status = 'running' and (v_live.ingest_lease_until is null or v_live.ingest_lease_until > now()) then return null; end if;
  if v_live.ingest_attempts >= 3 then
    update lives set ingest_status = 'needs_review', ingest_token = null, ingest_lease_until = null where id = p_live;
    update agent_runs set status = 'failed', finished_at = now(), error = 'recorder retry limit reached'
      where agent = 'A' and ref_id = 'live:' || p_live::text and status = 'running';
    return null;
  end if;
  update agent_runs set status = 'failed', finished_at = now(), error = 'recorder lease expired'
    where agent = 'A' and ref_id = 'live:' || p_live::text and status = 'running';
  update lives set ingest_status = 'running', ingest_token = p_token, ingest_lease_until = now() + interval '10 minutes',
    ingest_attempts = ingest_attempts + 1 where id = p_live;
  insert into agent_runs(agent, trigger, ref_id, model) values ('A', 'live_ended', 'live:' || p_live::text, p_model) returning id into v_run;
  return v_run;
end $$;

create function public.release_recorder(p_live bigint, p_token uuid, p_run bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update lives set ingest_status = case when ingest_attempts >= 3 then 'needs_review' else 'pending' end,
    ingest_token = null, ingest_lease_until = null
    where id = p_live and ingest_token = p_token and ingest_status = 'running';
  if found then
    update agent_runs set status = 'failed', error = 'recorder failed; no partial output committed', finished_at = now()
      where id = p_run and status = 'running';
  end if;
end $$;

-- Validated extraction and all derived writes commit together, including the run receipt.
-- Ownership token fences a late worker out after recovery. Retrying an acknowledged commit is a no-op.
create function public.commit_recorder(p_live bigint, p_token uuid, p_run bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_live lives%rowtype; x jsonb; t tags%rowtype; v_uid uuid; v_kind text;
  v_cards int := 0; v_interests int := 0; v_mentions int; v_speakers int;
  v_window int := (p_payload->>'window_days')::int;
  v_seen text[] := '{}'; v_key text; v_tag_ids bigint[] := '{}'; v_tag bigint;
begin
  select * into v_live from lives where id = p_live for update;
  if v_live.ingest_status in ('done','needs_review') and v_live.ingest_token = p_token then
    return jsonb_build_object('skipped', true);
  end if;
  if v_live.id is null or v_live.ingest_status <> 'running' or v_live.ingest_token is distinct from p_token
    or v_live.ingest_lease_until <= now() then raise exception 'recorder claim lost'; end if;
  if not exists(select 1 from agent_runs where id = p_run and agent = 'A' and ref_id = 'live:' || p_live::text and status = 'running') then
    raise exception 'invalid run';
  end if;
  -- Deterministic ordering reduces cross-live tag lock deadlocks; SQL still rolls back on any failure.
  for x in select value from jsonb_array_elements(p_payload->'items') order by value->>'tag', value->>'user_id', value->>'kind' loop
    v_uid := (x->>'user_id')::uuid; v_kind := x->>'kind';
    if v_kind not in ('knowledge', 'interest') or not exists(select 1 from live_participants where live_id = p_live and user_id = v_uid) then
      raise exception 'invalid participant or kind';
    end if;
    insert into tags(name, kind, status) values (x->>'tag', '分野', 'candidate') on conflict(name) do nothing;
    select * into strict t from tags where name = x->>'tag' for update;
    if t.status not in ('candidate','proposed','official') then continue; end if;
    if v_kind = 'knowledge' then
      insert into knowledge_cards(live_id, tag_id, speaker_id, headline, body, confidence)
        values(p_live, t.id, v_uid, left(coalesce(x->>'headline',''),200), coalesce(x->>'body',''), (x->>'confidence')::numeric);
      v_cards := v_cards + 1;
    else v_interests := v_interests + 1; end if;
    insert into user_tags(user_id, tag_id, kind, strength, source)
      values(v_uid, t.id, v_kind, 1, 'live')
      on conflict(user_id, tag_id, kind) do update set strength = least(999.99, user_tags.strength + 1), updated_at = now();
    update tags set mention_count = mention_count + 1, last_mentioned_at = now() where id = t.id;
    v_key := t.id::text || ':' || v_uid::text;
    if not (v_key = any(v_seen)) then
      insert into tag_mentions(tag_id, user_id, live_id, kind) values(t.id, v_uid, p_live, v_kind);
      v_seen := array_append(v_seen, v_key);
    end if;
    if not (t.id = any(v_tag_ids)) then v_tag_ids := array_append(v_tag_ids, t.id); end if;
  end loop;
  foreach v_tag in array v_tag_ids loop
    select count(*), count(distinct user_id) into v_mentions, v_speakers from tag_mentions
      where tag_id = v_tag and (v_window = 0 or created_at >= now() - make_interval(days => v_window));
    if v_mentions >= (p_payload->>'min_mentions')::int or v_speakers >= (p_payload->>'min_speakers')::int then
      update tags set status = 'proposed', proposed_at = now() where id = v_tag and status = 'candidate';
    end if;
  end loop;
  for x in select value from jsonb_array_elements(p_payload->'rejects') loop
    if length(x->>'name') <= 40 then
      insert into tags(name, kind, status, rejected_reason) values(x->>'name', '分野', 'rejected', x->>'reason') on conflict(name) do nothing;
    end if;
  end loop;
  update quests set encore_count = coalesce(encore_count, 0) + (p_payload->>'encore')::int where id = v_live.quest_id;
  update lives set ingest_status = case when (p_payload->>'needs_review')::boolean then 'needs_review' else 'done' end,
    ingest_lease_until = null where id = p_live;
  update agent_runs set status = 'succeeded', cost_usd = (p_payload->>'cost')::numeric,
    request_ids = array(select jsonb_array_elements_text(p_payload->'request_ids')),
    note = p_payload->>'note', finished_at = now() where id = p_run;
  return jsonb_build_object('cards', v_cards, 'interests', v_interests, 'needsReview', (p_payload->>'needs_review')::boolean);
end $$;

create function public.create_live_with_speaker(p_user uuid, p_title text, p_tag bigint, p_start timestamptz, p_minutes int)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if length(trim(p_title)) not between 2 and 60 or p_minutes not in (30,60,90,120) or p_start is null or p_start < now() - interval '5 minutes' then
    raise exception 'invalid live'; end if;
  if p_tag is not null and not exists(select 1 from tags where id = p_tag and status = 'official') then raise exception 'invalid tag'; end if;
  insert into lives(title, topic_tag_id, scheduled_start, scheduled_end, source_ref)
    values(trim(p_title), p_tag, p_start, p_start + make_interval(mins => p_minutes), 'user-' || gen_random_uuid()::text) returning id into v_id;
  insert into live_participants(live_id, user_id, role, invited_at) values(v_id, p_user, 'speaker', now());
  return v_id;
end $$;

-- SECURITY DEFINER is never an authorization bypass for browser roles.
revoke all on function public.start_organizer(text,date), public.start_mirror(uuid,text),
  public.claim_recorder(bigint,uuid,text), public.release_recorder(bigint,uuid,bigint),
  public.commit_recorder(bigint,uuid,bigint,jsonb), public.create_live_with_speaker(uuid,text,bigint,timestamptz,int)
  from public, anon, authenticated;
grant execute on function public.start_organizer(text,date), public.start_mirror(uuid,text),
  public.claim_recorder(bigint,uuid,text), public.release_recorder(bigint,uuid,bigint),
  public.commit_recorder(bigint,uuid,bigint,jsonb), public.create_live_with_speaker(uuid,text,bigint,timestamptz,int)
  to service_role;
commit;
