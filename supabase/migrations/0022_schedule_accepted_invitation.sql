-- 打診を引き受けたそのリクエスト内で、空き枠を選びライブを予約する。
-- 回答だけ先に確定されて予約が次回Cron待ちになる状態をなくす。
begin;

create or replace function public.respond_invitation(
  p_invitation_id bigint,
  p_accept boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv invitations%rowtype;
  v_tag_id bigint;
  v_tag_name text;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_live_id bigint;
  d integer;
begin
  update invitations
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_invitation_id
     and user_id = auth.uid()
     and status = 'sent'
  returning * into v_inv;

  if not found then
    raise exception 'この打診には答えられません';
  end if;
  if not p_accept then return; end if;

  select q.tag_id, t.name
    into v_tag_id, v_tag_name
    from quests q join tags t on t.id = q.tag_id
   where q.id = v_inv.quest_id
     and q.status in ('inviting', 'scheduling')
     and q.live_id is null
   for update of q;
  if not found then
    raise exception 'この企ては日程を決められる状態ではありません';
  end if;

  -- 明日から14日間の15:00〜16:00（日本時間）で最初の空きを選ぶ。
  for d in 1..14 loop
    v_day := (now() at time zone 'Asia/Tokyo')::date + d;
    v_start := (v_day + time '15:00') at time zone 'Asia/Tokyo';
    v_end := v_start + interval '1 hour';
    if not exists (
      select 1 from calendar_events e
       where e.user_id = v_inv.user_id and e.busy
         and e.starts_at < v_end and e.ends_at > v_start
    ) and not exists (
      select 1 from live_participants p join lives l on l.id = p.live_id
       where p.user_id = v_inv.user_id and p.role = 'speaker'
         and l.status in ('scheduled', 'live')
         and coalesce(l.scheduled_start, l.started_at) < v_end
         and coalesce(l.scheduled_end, l.ended_at, l.scheduled_start + interval '1 hour') > v_start
    ) then
      exit;
    end if;
    v_start := null;
  end loop;

  -- 14日間埋まっている場合は15日後を仮予約する（従来のBと同じ挙動）。
  if v_start is null then
    v_day := (now() at time zone 'Asia/Tokyo')::date + 15;
    v_start := (v_day + time '15:00') at time zone 'Asia/Tokyo';
    v_end := v_start + interval '1 hour';
  end if;

  insert into lives(title, topic_tag_id, quest_id, status, scheduled_start, scheduled_end, source_ref, ingest_status)
  values(v_tag_name, v_tag_id, v_inv.quest_id, 'scheduled', v_start, v_end,
         'organizer-quest-' || v_inv.quest_id::text, 'pending')
  returning id into v_live_id;

  insert into live_participants(live_id, user_id, role, invited_at)
  values(v_live_id, v_inv.user_id, 'speaker', now());

  insert into messages(live_id, user_id, body, is_agent)
  values(v_live_id, null, '「' || v_tag_name || '」の回、引き受けてくれた相談役の方に話してもらいます。よろしくお願いします！', true);

  update quests set status = 'opened', current_invitee = v_inv.user_id,
    live_id = v_live_id, next_action_at = v_start
  where id = v_inv.quest_id;

  insert into quest_steps(quest_id, kind, decision, reason) values
    (v_inv.quest_id, 'invite', 'open', '打診を引き受けたため日程調整へ進んだ'),
    (v_inv.quest_id, 'schedule', 'open',
      to_char(v_start at time zone 'Asia/Tokyo', 'YYYY/MM/DD HH24:MI') || 'にライブを予約した');
end;
$$;

revoke all on function public.respond_invitation(bigint, boolean) from public, anon;
grant execute on function public.respond_invitation(bigint, boolean) to authenticated;

commit;
