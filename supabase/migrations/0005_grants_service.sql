-- =====================================================================
--  service_role（サーバ側のエージェント）への権限
--
--  プロジェクト作成時に「Automatically expose new tables」を OFF にしたため、
--  新しく作ったテーブルには anon / authenticated だけでなく
--  ★ service_role にも権限が付いていなかった。
--
--  症状: エージェントから select も insert も
--        permission denied for table ... で落ちる
--        （RLS ではなく GRANT の問題なので service_role でも素通りできない）
-- =====================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- これから作るテーブルにも自動で付くようにする
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 確認：エージェントが lives を読めるか（true が出れば通る）
select has_table_privilege('service_role', 'lives',           'select') as lives読める,
       has_table_privilege('service_role', 'knowledge_cards', 'insert') as カード書ける,
       has_table_privilege('service_role', 'tags',            'select') as タグ読める;
