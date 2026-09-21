-- =====================================================================
--  画面確認用のデモデータ（9/22 追加分の画面: タグ帳・申請・ライブのタネ・打診・検索・地図）
--
--  入るもの（すべて架空。実在の会社名・顧客名・人名は使っていない）:
--    ・育ちかけのタグ 6つ（候補3・格上げ候補3） … タグ帳の単語帳に並ぶ札
--    ・「タグにしてほしい」の申請 … 札に「申請 n人」が付く
--    ・神谷 美月さんのプロフィールに 育ちかけの知見タグ2つ … 申請ボタンを押して試せる
--    ・正式タグ 5つと、進み具合がばらばらのライブのタネ 5つ … プランター（種→芽→若葉→つぼみ→花）
--    ・桜庭 芽衣さん宛の打診 1件 … AIからの打診の画面
--    ・振り返り会（終了）と Power BI の会（予定）のライブ … 検索で「ライブ」の段に出る
--
--  ★ 実行順序: 0020_tag_requests.sql のあと。SQL Editor に貼って実行する
--  ★ 冪等（何度流しても増えない）。消す処理は一切ない（delete / drop / truncate なし）
--  ★ 目印: ライブの source_ref が 'ui-demo-0021-…'
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- ① タグ
-- ---------------------------------------------------------------------
insert into tags (name, kind, status, proposed_at) values
  ('インデックス設計',     '技術', 'candidate', null),
  ('経費精算の出し方',     '業務', 'candidate', null),
  ('Teams会議の小技',      '技術', 'candidate', null),
  ('議事録の要約',         '業務', 'proposed',  now() - interval '2 days'),
  ('PADのエラー処理',      '技術', 'proposed',  now() - interval '1 day'),
  ('新人オンボーディング', '業務', 'proposed',  now() - interval '3 days'),
  -- ライブのタネ用（正式）
  ('Power BI',             '技術', 'official',  null),
  ('Excel関数',            '技術', 'official',  null),
  ('VBAの保守',            '技術', 'official',  null),
  ('要件定義',             '業務', 'official',  null),
  ('問い合わせ対応',       '業務', 'official',  null)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- ② ライブ（終了した振り返り会／予定の会）と参加者
-- ---------------------------------------------------------------------
insert into lives (title, status, started_at, ended_at, source_ref, ingest_status) values
  ('業務改善の振り返り会 — 小ワザを持ち寄る', 'ended', now() - interval '6 days 2 hours', now() - interval '6 days 1 hour', 'ui-demo-0021-review', 'done'),
  ('業務改善の振り返り会 — Excel関数の使い分け', 'ended', now() - interval '20 days 2 hours', now() - interval '20 days 1 hour', 'ui-demo-0021-excel', 'done')
on conflict (source_ref) do nothing;

insert into lives (title, status, scheduled_start, scheduled_end, source_ref, topic_tag_id)
select 'まなびのライブ — Power BI のはじめかた', 'scheduled',
       date_trunc('day', now()) + interval '3 days 16 hours' - interval '9 hours',
       date_trunc('day', now()) + interval '3 days 17 hours' - interval '9 hours',
       'ui-demo-0021-powerbi', t.id
from tags t where t.name = 'Power BI'
on conflict (source_ref) do nothing;

insert into live_participants (live_id, user_id, role, joined_at)
select l.id, u.id, case when u.display_name in ('神谷 美月','綾瀬 大輝') then 'speaker' else 'listener' end, l.started_at
from lives l
join users u on u.display_name in ('神谷 美月','早坂 悠人','綾瀬 大輝','桜庭 芽衣','藤代 咲良','白石 結衣','星野 陸')
where l.source_ref in ('ui-demo-0021-review','ui-demo-0021-excel')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- ③ 誰が 何を話したか（知見タグ・知見カード・語られた記録）
--    [語った人, タグ, カード見出し, カード本文（要約）]
-- ---------------------------------------------------------------------
create temp table _talk (who text, tag text, headline text, body text) on commit drop;
insert into _talk values
  ('神谷 美月', 'インデックス設計',     '検索が遅い表は まず絞り込みの列を見る',     '遅い検索は、条件に使う列に索引があるかを最初に確かめる。並び替えにも使う列なら複合で張ると効く。'),
  ('神谷 美月', 'Teams会議の小技',      '会議の最後の3分で決定事項を読み上げる',     '決まったことをその場で読み上げて全員の認識をそろえると、議事録の手戻りが減る。'),
  ('早坂 悠人', '経費精算の出し方',     '立替は月末より「使った週」に出す',           '領収書を失くす前に、使った週のうちに申請すると差し戻しが少ない。迷ったら総務の手引きの2章。'),
  ('綾瀬 大輝', '経費精算の出し方',     '交通費は経路の画面を添えると一発で通る',     '乗換案内の経路を画像で添えると、確認の往復がなくなる。'),
  ('藤代 咲良', '議事録の要約',         '要約は「決定・宿題・保留」の3つに分ける',   '発言順に書かず、決まったこと・誰が何をいつまでに・持ち越しの3つに分けると読まれる。'),
  ('白石 結衣', '議事録の要約',         '宿題には必ず名前と期限を付ける',             '担当と期限のない宿題は動かない。要約の最後に一覧にする。'),
  ('綾瀬 大輝', 'PADのエラー処理',      '落ちたら止めずに記録して次へ',               'フローの途中で失敗しても全体を止めず、失敗した行をログに残して最後にまとめて通知する。'),
  ('早坂 悠人', 'PADのエラー処理',      '待ち時間は固定より「出るまで待つ」',         '画面の読み込みは秒数で待たず、要素が出るまで待つ設定にすると失敗が減る。'),
  ('桜庭 芽衣', '新人オンボーディング', '初週は「誰に聞けばいいか」の地図を渡す',     '手順書より先に、困ったときの相談先の一覧を渡すと新人が止まらない。'),
  ('星野 陸',   '新人オンボーディング', '1日の終わりに5分だけ質問の時間を取る',       '聞きそびれを翌日に持ち越さないよう、終業前に短い時間を毎日取る。'),
  ('神谷 美月', 'Excel関数',            '検索はXLOOKUPに寄せる',                     '列の追加で壊れにくく、見つからないときの表示も決められる。'),
  ('綾瀬 大輝', 'Excel関数',            '集計はピボットより先にSUMIFSで考える',       '条件がはっきりしている集計は、関数で書くと他の人も追いやすい。');

insert into knowledge_cards (live_id, tag_id, speaker_id, headline, body, confidence, created_at)
select l.id, t.id, u.id, x.headline, x.body, 0.8, l.ended_at
from _talk x
join tags t on t.name = x.tag
join users u on u.display_name = x.who
join lives l on l.source_ref = case when x.tag = 'Excel関数' then 'ui-demo-0021-excel' else 'ui-demo-0021-review' end
where not exists (select 1 from knowledge_cards k where k.live_id = l.id and k.headline = x.headline);

insert into user_tags (user_id, tag_id, kind, strength, source, visibility)
select u.id, t.id, 'knowledge', 1.0, 'live', 'public'
from _talk x join tags t on t.name = x.tag join users u on u.display_name = x.who
on conflict (user_id, tag_id, kind) do nothing;

-- 語られた記録（直近30日）。ライブのタネの「需要」とタグ帳の「○つのライブ・○人」に効く
insert into tag_mentions (tag_id, user_id, live_id, kind, created_at)
select t.id, u.id, l.id, 'knowledge', l.ended_at
from _talk x
join tags t on t.name = x.tag
join users u on u.display_name = x.who
join lives l on l.source_ref = case when x.tag = 'Excel関数' then 'ui-demo-0021-excel' else 'ui-demo-0021-review' end
where not exists (select 1 from tag_mentions m where m.live_id = l.id and m.tag_id = t.id and m.user_id = u.id);

-- ライブのタネの需要に差をつける（Power BI > 問い合わせ対応 > 要件定義 > VBAの保守）。興味として語られた記録
insert into tag_mentions (tag_id, user_id, live_id, kind, created_at)
select t.id, u.id, l.id, 'interest', l.ended_at
from (values ('Power BI','早坂 悠人'),('Power BI','桜庭 芽衣'),('Power BI','藤代 咲良'),('Power BI','白石 結衣'),('Power BI','星野 陸'),
             ('問い合わせ対応','星野 陸'),('問い合わせ対応','藤代 咲良'),('問い合わせ対応','白石 結衣'),
             ('要件定義','桜庭 芽衣'),('要件定義','白石 結衣'),
             ('VBAの保守','綾瀬 大輝')) v(tag, who)
join tags t on t.name = v.tag
join users u on u.display_name = v.who
join lives l on l.source_ref = 'ui-demo-0021-review'
where not exists (select 1 from tag_mentions m where m.live_id = l.id and m.tag_id = t.id and m.user_id = u.id and m.kind = 'interest');

-- ---------------------------------------------------------------------
-- ④ 「タグにしてほしい」の申請（0020）
--    経費精算の出し方 … 2人／新人オンボーディング … 1人
--    ★ 神谷さんの インデックス設計 は申請していない（画面で押して試す用）
-- ---------------------------------------------------------------------
insert into tag_requests (tag_id, user_id)
select t.id, u.id
from (values ('経費精算の出し方','早坂 悠人'),('経費精算の出し方','綾瀬 大輝'),('新人オンボーディング','桜庭 芽衣')) v(tag, who)
join tags t on t.name = v.tag join users u on u.display_name = v.who
on conflict do nothing;

-- ---------------------------------------------------------------------
-- ⑤ ライブのタネ（quests）を 進み具合ごとに1つずつ
--    VBAの保守=育ち待ち／問い合わせ対応=相談中（桜庭さんに打診）／要件定義=日程を決め中
--    Power BI=予約済み（予定のライブ）／Excel関数=開催済み（終了したライブ）
-- ---------------------------------------------------------------------
insert into quests (tag_id, status, interested_ids, current_invitee, tried_count, live_id, next_action_at, closed_at, outcome)
select t.id, v.status,
       array(select id from users where display_name = any(v.interested)),
       (select id from users where display_name = v.invitee),
       case when v.invitee is null then 0 else 1 end,
       (select id from lives where source_ref = v.live_ref),
       now() + interval '1 day',
       case when v.status = 'done' then now() - interval '20 days' end,
       case when v.status = 'done' then 'ライブを開催した' end
from (values
  ('VBAの保守',      'scouting',   array['綾瀬 大輝'],                                   null,        null),
  ('問い合わせ対応', 'inviting',   array['星野 陸','藤代 咲良','白石 結衣'],              '桜庭 芽衣', null),
  ('要件定義',       'scheduling', array['桜庭 芽衣','白石 結衣'],                        '早坂 悠人', null),
  ('Power BI',       'opened',     array['早坂 悠人','桜庭 芽衣','藤代 咲良','白石 結衣','星野 陸'], '神谷 美月', 'ui-demo-0021-powerbi'),
  ('Excel関数',      'done',       array['星野 陸','白石 結衣'],                          '神谷 美月', 'ui-demo-0021-excel')
) v(tag, status, interested, invitee, live_ref)
join tags t on t.name = v.tag
where not exists (select 1 from quests q where q.tag_id = t.id);

update lives l set quest_id = q.id
from quests q join tags t on t.id = q.tag_id
where l.source_ref = case t.name when 'Power BI' then 'ui-demo-0021-powerbi' when 'Excel関数' then 'ui-demo-0021-excel' end
  and l.quest_id is null;

insert into quest_steps (quest_id, kind, decision, reason, created_at)
select q.id, v.kind, v.decision, v.reason, now() - v.ago
from (values
  ('VBAの保守',      'judge',    'wait', '興味を持つ人がまだ1人。答えられる人も社内に少ないので、もう少し待つ', interval '5 hours'),
  ('問い合わせ対応', 'judge',    'open', '興味が3人に増えた。知見カードのある人に相談役を頼む', interval '1 day'),
  ('問い合わせ対応', 'invite',   'sent', '桜庭さんに相談役を打診した', interval '20 hours'),
  ('要件定義',       'invite',   'accepted', '早坂さんが引き受けた。空いている枠を探している', interval '10 hours'),
  ('Power BI',       'open',     'opened', '5人の空きがそろう枠でライブを予約した', interval '2 days'),
  ('Excel関数',      'open',     'done', 'ライブを開催し、知見カードが2枚生まれた', interval '20 days')
) v(tag, kind, decision, reason, ago)
join tags t on t.name = v.tag
join quests q on q.tag_id = t.id
where not exists (select 1 from quest_steps s where s.quest_id = q.id and s.reason = v.reason);

-- 打診（桜庭さん宛て＝未回答／早坂さん＝引き受け済み）
insert into invitations (quest_id, user_id, status, sent_at, responded_at)
select q.id, u.id, v.status, now() - v.ago, case when v.status = 'accepted' then now() - interval '10 hours' end
from (values ('問い合わせ対応','桜庭 芽衣','sent', interval '20 hours'), ('要件定義','早坂 悠人','accepted', interval '1 day')) v(tag, who, status, ago)
join tags t on t.name = v.tag join quests q on q.tag_id = t.id join users u on u.display_name = v.who
where not exists (select 1 from invitations i where i.quest_id = q.id and i.user_id = u.id);

commit;

-- =====================================================================
--  確認  期待 → 育ちかけ6以上 ／ 申請3 ／ タネ5 ／ 打診(未回答)1以上 ／ デモのライブ3
-- =====================================================================
select
  (select count(*) from tags where name in ('インデックス設計','経費精算の出し方','Teams会議の小技','議事録の要約','PADのエラー処理','新人オンボーディング') and status in ('candidate','proposed')) as 育ちかけ,
  (select count(*) from tag_requests)                                                          as 申請,
  (select count(*) from quests q join tags t on t.id = q.tag_id where t.name in ('Power BI','Excel関数','VBAの保守','要件定義','問い合わせ対応')) as タネ,
  (select count(*) from invitations where status = 'sent')                                     as 打診_未回答,
  (select count(*) from lives where source_ref like 'ui-demo-0021-%')                          as デモのライブ;
