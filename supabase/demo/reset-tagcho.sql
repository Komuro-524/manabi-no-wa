-- =====================================================================
--  デモ用: タグ帳の札を「仕分ける前」に戻す
--
--  いつ使う: 展示やデモで、来た人にタグ帳の仕分け（採用＝めくる／却下＝破る）を体験してもらう前。
--  何をする: 下の「デモの札」に並べたタグだけを、元の 候補／格上げ候補 に戻し、申請も元に戻す。
--           ★ ここに書いていないタグ（本物の運用で決めたタグ）には一切触らない。
--  使い方  : Supabase の SQL Editor に貼って Run。何回流してもよい。
--           前提: 0020_tag_requests.sql と 0021_ui_demo_seed.sql を流したあと
--
--  ★ delete / drop / truncate は使っていない（update と insert だけ）
--  ★ 札を増やしたいとき: 下の values に ('タグ名', 'candidate' か 'proposed') を1行足す。
--    辞書に無い名前なら新しく作る（分類は「分野」）
-- =====================================================================
begin;

create temp table _deck (name text, status text) on commit drop;
insert into _deck values
  -- タグ名                 戻す状態
  ('インデックス設計',     'candidate'),
  ('経費精算の出し方',     'candidate'),
  ('Teams会議の小技',      'candidate'),
  ('議事録の要約',         'proposed'),
  ('PADのエラー処理',      'proposed'),
  ('新人オンボーディング', 'proposed');

-- ① 辞書に無ければ作る
insert into tags (name, kind, status)
select name, '分野', status from _deck
on conflict (name) do nothing;

-- ② 状態を戻す（採用・却下・禁止の記録も消して、まっさらな札に）
update tags t
   set status          = d.status,
       proposed_at     = case when d.status = 'proposed' then now() - interval '1 day' end,
       promoted_at     = null,
       rejected_reason = null,
       reviewed_by     = null,
       reviewed_at     = null,
       review_note     = null
  from _deck d
 where t.name = d.name;

-- ③ 申請を戻す（「申請 n人」の表示用）。付いている知見タグの持ち主からだけ
insert into tag_requests (tag_id, user_id)
select t.id, u.id
from (values ('経費精算の出し方','早坂 悠人'),
             ('経費精算の出し方','綾瀬 大輝'),
             ('新人オンボーディング','桜庭 芽衣')) v(tag, who)
join tags t  on t.name = v.tag
join users u on u.display_name = v.who
where exists (select 1 from user_tags ut where ut.user_id = u.id and ut.tag_id = t.id)
on conflict do nothing;

commit;

-- 確認: デモの札がタグ帳に並ぶ状態か（すべて 候補 か 格上げ候補 になっていればOK）
select t.name as 札, t.status as 状態,
       (select count(*) from tag_requests r where r.tag_id = t.id) as 申請
from tags t
where t.name in ('インデックス設計','経費精算の出し方','Teams会議の小技','議事録の要約','PADのエラー処理','新人オンボーディング')
order by 申請 desc, t.status desc;
