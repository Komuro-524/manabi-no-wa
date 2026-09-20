-- =====================================================================
--  学びの輪 — テーブルへの公開許可（GRANT）
--
--  プロジェクト作成時に「Automatically expose new tables」を OFF にしたので、
--  ブラウザ（anon / authenticated）からは どのテーブルにも届かない状態。
--  ここで「見せてよいテーブル」だけ明示的に許可する。
--
--  ★ quests / quest_steps / agent_runs は許可しない
--    ＝ ブラウザからは「存在しないテーブル」になる。RLS 以前に届かない
--
--  0001 → 0002 のあとに実行する（0003 との順番はどちらでもよい）
-- =====================================================================

-- スキーマ自体への到達を許可する（これが無いと何も見えない）
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 読む
-- ---------------------------------------------------------------------
grant select on
  users,
  tags,
  lives,
  live_participants,
  messages,
  knowledge_cards,
  user_tags,
  invitations,
  calendar_events,
  self_analysis_sessions
to authenticated;

-- ---------------------------------------------------------------------
-- 書く（さらに RLS の with check で絞られる）
-- ---------------------------------------------------------------------
grant insert on live_participants to authenticated;   -- ライブに参加する
grant insert on messages          to authenticated;   -- コメントする
grant update on tags              to authenticated;   -- 管理者だけ（RLSで判定）

-- bigserial の insert には シーケンスの usage が要る
grant usage on sequence messages_id_seq to authenticated;

-- ---------------------------------------------------------------------
-- ★ 意図的に許可しないもの
--    quests / quest_steps / agent_runs
--    → service_role（サーバー側のエージェント）だけが触る
--
--    users への update も許可しない
--    → 一般社員が自分を管理者にできないようにするため
-- ---------------------------------------------------------------------


-- =====================================================================
--  確認：ここまで全部通ったか1発で見る
--  期待 → テーブル13 ／ RLS有効13 ／ ポリシー13 ／ 関数3
-- =====================================================================
select
  (select count(*) from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r')          as テーブル数,
  (select count(*) from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r'
       and relrowsecurity)                                                   as RLS有効,
  (select count(*) from pg_policies where schemaname = 'public')             as ポリシー数,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_admin','set_tag_visibility','respond_invitation')) as 関数,
  (select count(*) from tags)                                                as タグ;
