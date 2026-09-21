-- =====================================================================
--  未知の話者を「人に返す」ための拡張
--
--  背景:
--    タグ付けエージェントAは話者名を display_name の完全一致で照合していたため、
--    「星野陸」と「星野 陸」（空白1個の差）を別人と判断し、
--    架空社員を勝手に作ってしまった。
--
--  方針:
--    1. Aは社員を作らない（コード側で対応）
--    2. 名簿に無い話者がいたライブは done にせず needs_review で止める
--    3. 誰が未確認なのかを agent_runs に残す
--
--  ★ 人が介在する4つめの点になる
-- =====================================================================

alter table lives drop constraint if exists lives_ingest_status_check;
alter table lives add  constraint lives_ingest_status_check
  check (ingest_status in ('pending','running','done','needs_review','failed'));

alter table agent_runs add column if not exists note text;

comment on column agent_runs.note is
  '人の確認が要る特記事項。失敗ではないが放置してはいけないこと';


-- 確認
select
  (select count(*) from pg_constraint
    where conname = 'lives_ingest_status_check')                          as 制約あり,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='agent_runs'
      and column_name='note')                                             as note列あり;
