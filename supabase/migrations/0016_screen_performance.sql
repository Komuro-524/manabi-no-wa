begin;
-- Read-only query improvements. No data deletion or RLS policy changes.
create index if not exists quest_steps_latest_idx on public.quest_steps(quest_id, id desc);
create index if not exists quests_status_id_idx on public.quests(status, id desc);
create index if not exists agent_runs_agent_id_idx on public.agent_runs(agent, id desc);
create index if not exists tag_mentions_recent_idx on public.tag_mentions(created_at, tag_id);
create index if not exists messages_live_id_idx on public.messages(live_id, id desc);
create index if not exists transcript_segments_live_seq_idx on public.transcript_segments(live_id, seq desc);

-- Invoker: aggregate ONLY the rows the requesting user may read under RLS.
create or replace function public.knowledge_map_stats()
returns jsonb language sql stable security invoker set search_path = public as $$
with cards as materialized (
  select c.tag_id,c.live_id from knowledge_cards c join tags t on t.id=c.tag_id where t.status='official'
), counts as (select tag_id,count(*) as cards from cards group by tag_id),
people as (
  select tag_id,count(distinct user_id) as people,bool_or(user_id=auth.uid()) as mine
  from user_tags group by tag_id
), nodes as materialized (
  select t.id,t.name,t.kind,coalesce(c.cards,0) as cards,coalesce(p.people,0) as people,coalesce(p.mine,false) as mine
  from tags t left join counts c on c.tag_id=t.id left join people p on p.tag_id=t.id
  where t.status='official' order by coalesce(c.cards,0) desc,t.id limit 60
), pairs as (
  select distinct c.tag_id,c.live_id from cards c join nodes n on n.id=c.tag_id where c.live_id is not null
), edges as (
  select a.tag_id as a,b.tag_id as b,count(*) as w from pairs a join pairs b on a.live_id=b.live_id and a.tag_id<b.tag_id group by a.tag_id,b.tag_id
)
select jsonb_build_object('nodes',coalesce((select jsonb_agg(n order by n.cards desc,n.id) from nodes n),'[]'::jsonb),
  'edges',coalesce((select jsonb_agg(e) from edges e),'[]'::jsonb),
  'total',(select count(*) from tags where status='official'))
$$;
revoke all on function public.knowledge_map_stats() from public,anon;
grant execute on function public.knowledge_map_stats() to authenticated;

-- Caller must verify admin before using service_role. Never expose raw mentions.
create or replace function public.admin_tag_stats(p_since timestamptz)
returns table(tag_id bigint,lives bigint,users bigint)
language sql stable security invoker set search_path = public as $$
select tag_id,count(distinct live_id),count(distinct user_id) from tag_mentions
where created_at>=p_since group by tag_id
$$;
revoke all on function public.admin_tag_stats(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_tag_stats(timestamptz) to service_role;

create or replace function public.admin_month_cost(p_since timestamptz)
returns numeric language sql stable security invoker set search_path = public as $$
select coalesce(sum(cost_usd),0) from agent_runs where started_at>=p_since
$$;
revoke all on function public.admin_month_cost(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_month_cost(timestamptz) to service_role;

-- Reduce calendar history transfer while retaining RLS and overlap semantics.
create or replace function public.calendar_lives(p_from timestamptz,p_to timestamptz)
returns table(live_id bigint,role text,lives jsonb)
language sql stable security invoker set search_path = public as $$
select l.id,p.role,jsonb_build_object('id',l.id,'title',l.title,'status',l.status,
  'scheduled_start',l.scheduled_start,'scheduled_end',l.scheduled_end,'started_at',l.started_at,'ended_at',l.ended_at)
from live_participants p join lives l on l.id=p.live_id
where p.user_id=auth.uid() and coalesce(l.scheduled_start,l.started_at)<p_to
and (case when coalesce(l.scheduled_end,l.ended_at,coalesce(l.scheduled_start,l.started_at))-coalesce(l.scheduled_start,l.started_at)<interval '30 minutes'
then coalesce(l.scheduled_start,l.started_at)+interval '1 hour' else coalesce(l.scheduled_end,l.ended_at) end)>p_from
$$;
revoke all on function public.calendar_lives(timestamptz,timestamptz) from public,anon;
grant execute on function public.calendar_lives(timestamptz,timestamptz) to authenticated;

commit;
