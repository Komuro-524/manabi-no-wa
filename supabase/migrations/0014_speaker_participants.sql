-- =====================================================================
--  場づくりエージェントが予約したライブに、引き受けた人を「話し手」として入れる（後追い）
--
--  organizer.mjs は予約時に話し手を live_participants に入れるよう直した。
--  それ以前に予約された分（予約済みで、まだ参加者がいないライブ）を埋める。
--  ★ insert だけ。消す処理は無い。2回流しても増えない（on conflict do nothing）
-- =====================================================================
begin;

insert into live_participants (live_id, user_id, role, invited_at)
select l.id, q.current_invitee, 'speaker', now()
from lives l
join quests q on q.id = l.quest_id
where l.status = 'scheduled'
  and q.status = 'opened'
  and q.current_invitee is not null
on conflict do nothing;

commit;

-- 確認: 予約済みのライブと話し手
select l.id, l.title, to_char(l.scheduled_start at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') as 開始, u.display_name as 話し手
from lives l
join live_participants lp on lp.live_id = l.id and lp.role = 'speaker'
join users u on u.id = lp.user_id
where l.status = 'scheduled'
order by l.scheduled_start;
