-- =====================================================================
--  候補タグのカードと人のタグを、一般の社員から隠す（F4・F5）
--  ★ 9/21 決定: 案B（DESIGN.md §5.4 に追記済み）
--
--  背景:
--    tags テーブル自体は「候補・格上げ候補は管理者だけ」というRLSに
--    なっていたが、そのタグを指す knowledge_cards / user_tags は
--    「全員読める」「公開なら全員」のままだった。
--    → タグ名は隠れているのに、それが付いたカードや人のタグは
--      正式になる前から全社に見えてしまっていた（穴）。
--
--  方針:
--    knowledge_cards / user_tags の select ポリシーに
--    「そのタグが official かどうか」を条件として足す。
--    正式になった瞬間、tags の1行を書き換えるだけで、
--    過去のカードも人のタグも一斉に全員へ見えるようになる
--    （バックフィル不要。DESIGN.md §5.4 の性質がそのまま活きる）。
--
--    あわせて F5: messages の投稿を「開催中のライブの参加者」だけに絞る
--    （今までは is_agent=false と lives.status='live' だけで、
--      live_participants を見ていなかった＝参加者以外も投稿できた）。
--
--  ★ 自分の非公開タグ・候補タグは本人には見える（本人のプロフィールで
--    「育ちかけ」と出せるように）。管理者には常に見える。
--  ★ 2回流しても通るように、create の前に新ポリシー名も drop しておく。
--  ★ 全体を1トランザクションにする（途中で失敗したら丸ごと戻る）。
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- F4-1: knowledge_cards
-- ---------------------------------------------------------------------
drop policy if exists "知見カードは全員読める" on knowledge_cards;
drop policy if exists "正式タグのカードは全員 それ以外は話した本人か管理者" on knowledge_cards;

create policy "正式タグのカードは全員 それ以外は話した本人か管理者" on knowledge_cards
  for select to authenticated
  using (
    exists (select 1 from tags t where t.id = knowledge_cards.tag_id and t.status = 'official')
    or speaker_id = auth.uid()
    or is_admin()
  );

-- ---------------------------------------------------------------------
-- F4-2: user_tags
--   ★ 元のポリシーは visibility だけを見ていた。
--     ここに「タグが official か」も足す。
--     本人が見えるのは変わらない（visibility に関係なく自分の行は見える）。
-- ---------------------------------------------------------------------
drop policy if exists "公開は全員 非公開は本人だけ" on user_tags;
drop policy if exists "正式タグかつ公開は全員 それ以外は本人か管理者" on user_tags;

create policy "正式タグかつ公開は全員 それ以外は本人か管理者" on user_tags
  for select to authenticated
  using (
    (visibility = 'public'
      and exists (select 1 from tags t where t.id = user_tags.tag_id and t.status = 'official'))
    or user_id = auth.uid()
    or is_admin()
  );

-- ---------------------------------------------------------------------
-- F5: messages（チャット）の投稿を「開催中のライブの参加者」だけに絞る
--   ★ 元のポリシーは is_agent=false と lives.status='live' だけを見ていた。
--     live_participants に本人がいることも条件に足す。
-- ---------------------------------------------------------------------
drop policy if exists "自分としてだけ投稿できる" on messages;
drop policy if exists "参加者だけが開催中のライブに投稿できる" on messages;

create policy "参加者だけが開催中のライブに投稿できる" on messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_agent = false
    and exists (select 1 from lives l where l.id = messages.live_id and l.status = 'live')
    and exists (
      select 1 from live_participants lp
      where lp.live_id = messages.live_id and lp.user_id = auth.uid()
    )
  );

commit;

-- =====================================================================
--  確認
--  期待 → knowledge_cards・user_tags・messages とも 新しいポリシー名が1件ずつ、
--         古いポリシー名は0件
-- =====================================================================
select
  (select count(*) from pg_policies
     where schemaname='public' and tablename='knowledge_cards'
       and policyname='正式タグのカードは全員 それ以外は話した本人か管理者')  as 新_カード,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='knowledge_cards'
       and policyname='知見カードは全員読める')                              as 旧_カード残,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='user_tags'
       and policyname='正式タグかつ公開は全員 それ以外は本人か管理者')        as 新_タグ,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='user_tags'
       and policyname='公開は全員 非公開は本人だけ')                          as 旧_タグ残,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='messages'
       and policyname='参加者だけが開催中のライブに投稿できる')               as 新_投稿,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='messages'
       and policyname='自分としてだけ投稿できる')                             as 旧_投稿残;
