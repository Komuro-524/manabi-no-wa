-- =====================================================================
--  OrcaRouterの確定費用と突き合わせるための下ごしらえ（F7）
--
--  背景:
--    今まで各エージェントが記録している cost_usd は、呼び出し直後に
--    レスポンスヘッダから読んだ「インライン額」。OrcaRouter側で
--    確定した額（GET /v1/generation?id=<id> の total_cost）と
--    ズレていないかを、あとから突き合わせて確認したい。
--
--  方針:
--    各呼び出しの X-Orca-Request-Id を agent_runs に配列で残しておく。
--    scripts/reconcile-costs.mjs が この id を1本ずつ引いて突き合わせる。
-- =====================================================================

alter table agent_runs add column if not exists request_ids text[];

comment on column agent_runs.request_ids is
  'OrcaRouterの X-Orca-Request-Id。1回の実行で複数回LLMを呼ぶことがあるので配列';

-- 確認
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='agent_runs'
       and column_name='request_ids')                                as request_ids列あり;
