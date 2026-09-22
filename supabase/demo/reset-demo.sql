-- =====================================================================
--  デモ用: 画面を触ってもらう前に「デモの最初の状態」へまとめて戻す
--
--  戻すもの（すべて 0021_ui_demo_seed.sql で入れたデモ用のデータだけ）:
--    A. タグ帳の札 6枚 …… 候補／格上げ候補に戻し、「申請 n人」も戻す（reset-tagcho.sql と同じ）
--    B. 神谷さんの申請ボタン …… 「申請中 ✓」を押す前に戻す
--    C. 神谷さんの育ちかけタグの公開／非公開 …… 公開に戻す
--    D. 桜庭さん宛の打診 …… 「引き受ける／今は難しい」を押す前に戻す
--    E. ライブのタネ 5つ …… 種・芽・葉・つぼみ・花の並びに戻す
--    F. Power BI の予定のライブ …… 「始める」を押していたら予定に戻す
--    G. 配信中のライブを1つ用意する …… 「Teams会議の小技を持ち寄る」が いま配信中（コメントつき）。
--       デモで「終える」を押されていたら、それは過去のライブとして残し、新しく配信中のものを立て直す
--
--  使い方: Supabase の SQL Editor に貼って Run。何回流してもよい。
--  ★ 本物の運用データには触らない（名前や source_ref でデモの行だけに絞っている）
--  ★ B だけ delete を使う（神谷さんの デモ用2タグ への申請だけ。ほかの申請は消えない）
--  ★ 戻せないもの: デモ中に新しく作ったライブ・コメント・知見カード（消す処理は入れていない）
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- A. タグ帳の札
-- ---------------------------------------------------------------------
create temp table _deck (name text, status text) on commit drop;
insert into _deck values
  ('インデックス設計',     'candidate'),
  ('経費精算の出し方',     'candidate'),
  ('Teams会議の小技',      'candidate'),
  ('議事録の要約',         'proposed'),
  ('PADのエラー処理',      'proposed'),
  ('新人オンボーディング', 'proposed');

insert into tags (name, kind, status)
select name, '分野', status from _deck
on conflict (name) do nothing;

update tags t
   set status = d.status,
       proposed_at = case when d.status = 'proposed' then now() - interval '1 day' end,
       promoted_at = null, rejected_reason = null, reviewed_by = null, reviewed_at = null, review_note = null
  from _deck d
 where t.name = d.name;

insert into tag_requests (tag_id, user_id)
select t.id, u.id
from (values ('経費精算の出し方','早坂 悠人'), ('経費精算の出し方','綾瀬 大輝'), ('新人オンボーディング','桜庭 芽衣')) v(tag, who)
join tags t on t.name = v.tag
join users u on u.display_name = v.who
where exists (select 1 from user_tags ut where ut.user_id = u.id and ut.tag_id = t.id)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- B. 神谷さんの申請ボタン（押す前に戻す）
-- ---------------------------------------------------------------------
delete from tag_requests r
 using tags t, users u
 where r.tag_id = t.id and r.user_id = u.id
   and u.display_name = '神谷 美月'
   and t.name in ('インデックス設計', 'Teams会議の小技');

-- ---------------------------------------------------------------------
-- C. 神谷さんの育ちかけタグを公開に戻す
-- ---------------------------------------------------------------------
update user_tags ut
   set visibility = 'public', updated_at = now()
  from tags t, users u
 where ut.tag_id = t.id and ut.user_id = u.id
   and u.display_name = '神谷 美月'
   and t.name in ('インデックス設計', 'Teams会議の小技')
   and ut.visibility <> 'public';

-- ---------------------------------------------------------------------
-- D. 桜庭さん宛の打診を「未回答」に戻す
-- ---------------------------------------------------------------------
update invitations i
   set status = 'sent', responded_at = null, sent_at = now() - interval '20 hours'
  from quests q, tags t, users u
 where i.quest_id = q.id and q.tag_id = t.id and i.user_id = u.id
   and t.name = '問い合わせ対応' and u.display_name = '桜庭 芽衣';

-- ---------------------------------------------------------------------
-- E. ライブのタネを 種・芽・葉・つぼみ・花 に戻す
--    （「いま1周動かす」でエージェントが進めていても、デモの並びに戻る）
-- ---------------------------------------------------------------------
update quests q
   set status          = v.status,
       current_invitee = (select id from users where display_name = v.invitee),
       live_id         = (select id from lives where source_ref = v.live_ref),
       next_action_at  = now() + interval '1 day',
       closed_at       = case when v.status = 'done' then now() - interval '20 days' end
  from (values
    ('VBAの保守',      'scouting',   null,        null),
    ('問い合わせ対応', 'inviting',   '桜庭 芽衣', null),
    ('要件定義',       'scheduling', '早坂 悠人', null),
    ('Power BI',       'opened',     '神谷 美月', 'ui-demo-0021-powerbi'),
    ('Excel関数',      'done',       '神谷 美月', 'ui-demo-0021-excel')
  ) v(tag, status, invitee, live_ref), tags t
 where q.tag_id = t.id and t.name = v.tag
   and q.id = (select min(q2.id) from quests q2 where q2.tag_id = t.id);   -- デモで入れた最初の1つだけ

-- ---------------------------------------------------------------------
-- F. Power BI の予定のライブを「予定」に戻す（日時もデモ用の3日後 16:00 に）
-- ---------------------------------------------------------------------
update lives
   set status = 'scheduled', started_at = null, ended_at = null, ingest_status = 'pending',
       scheduled_start = date_trunc('day', now()) + interval '3 days 16 hours' - interval '9 hours',
       scheduled_end   = date_trunc('day', now()) + interval '3 days 17 hours' - interval '9 hours'
 where source_ref = 'ui-demo-0021-powerbi';

-- ---------------------------------------------------------------------
-- G. 配信中のライブを1つ用意する
--    ・いま配信中のデモライブがあれば、開始時刻だけ「15分前」に直してそのまま使う
--    ・終わっていたら（デモで「終える」を押された）、目印を外して過去のライブとして残し、新しく立てる
--      ★ 同じライブを配信中に戻すと、もう一度終えたときにタグ付けが二重に走るため 作り直す
-- ---------------------------------------------------------------------
update lives set source_ref = 'ui-demo-onair-old-' || id
 where source_ref = 'ui-demo-onair' and status <> 'live';

insert into lives (title, status, started_at, source_ref, topic_tag_id)
select 'まなびのライブ — Teams会議の小技を持ち寄る', 'live', now() - interval '15 minutes', 'ui-demo-onair', t.id
from tags t where t.name = 'Teams会議の小技'
on conflict (source_ref) do nothing;

update lives set started_at = now() - interval '15 minutes'
 where source_ref = 'ui-demo-onair' and status = 'live';

insert into live_participants (live_id, user_id, role, joined_at)
select l.id, u.id, case when u.display_name = '神谷 美月' then 'speaker' else 'listener' end, l.started_at
from lives l
join users u on u.display_name in ('神谷 美月','早坂 悠人','藤代 咲良','白石 結衣')
where l.source_ref = 'ui-demo-onair'
on conflict do nothing;

-- コメント（まだ1件も無いときだけ入れる＝デモ中のコメントは消さない）
insert into messages (live_id, user_id, body, is_agent, created_at)
select l.id, (select id from users where display_name = v.who), v.body, v.who is null, now() - v.ago
from lives l
cross join (values
  (null,        '場づくりエージェントです。「Teams会議の小技」に興味のある人が集まったので場を開きました。まずは最近助かった小ワザを1つずつどうぞ', interval '14 minutes'),
  ('神谷 美月', '会議の最後に3分だけ取って、決まったことを読み上げるようにしています。議事録の手戻りがかなり減りました', interval '12 minutes'),
  ('早坂 悠人', 'それいいですね。読み上げるとき、画面に決定事項だけ出してますか？', interval '10 minutes'),
  ('神谷 美月', 'はい、チャットに箇条書きで貼ってから読んでいます。あとから探すときもチャットを見れば済むので', interval '9 minutes'),
  ('藤代 咲良', '招待を送るときに議題を3行で本文に書いておくと、当日の脱線が減りました', interval '6 minutes'),
  ('白石 結衣', '録画をオンにする前にひと言断る、のルールを部署で決めたら安心して話せるようになりました', interval '3 minutes')
) v(who, body, ago)
where l.source_ref = 'ui-demo-onair'
  and not exists (select 1 from messages m where m.live_id = l.id);

commit;

-- =====================================================================
--  確認（1行）
--  期待 → タグ帳の札6 ／ 申請3 ／ 神谷さんの申請0 ／ 打診_未回答1 ／ タネの並びOK=5 ／ PowerBI=scheduled ／ 配信中=live
-- =====================================================================
select
  (select count(*) from tags where name in ('インデックス設計','経費精算の出し方','Teams会議の小技','議事録の要約','PADのエラー処理','新人オンボーディング')
     and status in ('candidate','proposed'))                                                            as タグ帳の札,
  (select count(*) from tag_requests r join tags t on t.id = r.tag_id
     where t.name in ('経費精算の出し方','新人オンボーディング'))                                        as 申請,
  (select count(*) from tag_requests r join users u on u.id = r.user_id join tags t on t.id = r.tag_id
     where u.display_name = '神谷 美月' and t.name in ('インデックス設計','Teams会議の小技'))            as 神谷さんの申請,
  (select count(*) from invitations i join users u on u.id = i.user_id join quests q on q.id = i.quest_id join tags t on t.id = q.tag_id
     where u.display_name = '桜庭 芽衣' and t.name = '問い合わせ対応' and i.status = 'sent')             as 打診_未回答,
  (select count(*) from quests q join tags t on t.id = q.tag_id
     where (t.name, q.status) in (('VBAの保守','scouting'),('問い合わせ対応','inviting'),('要件定義','scheduling'),('Power BI','opened'),('Excel関数','done'))) as タネの並びOK,
  (select status from lives where source_ref = 'ui-demo-0021-powerbi')                                  as PowerBI,
  (select status from lives where source_ref = 'ui-demo-onair')                                         as 配信中;
