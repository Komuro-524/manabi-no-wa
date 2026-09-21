-- =====================================================================
--  タグが「いつ・誰に」語られたかの記録（格上げ判定を期間で区切るため）
--
--  背景:
--    格上げ候補の条件（延べN回 または M人以上）を tags.mention_count（累計）で
--    見ていたため、半年前に1回話しただけの話題もずっと数に残っていた。
--
--  方針:
--    1回語られるごとに1行残す。格上げの判定は「直近D日」の行だけを数える。
--    tags.mention_count は累計の表示用として残す。
--
--  ★ (live_id, user_id) は live_participants への複合外部キー。
--    その場にいない人の名義で「語った」ことにはできない（0008 と同じ考え方）。
-- =====================================================================

create table tag_mentions (
  id         bigserial primary key,
  tag_id     bigint not null references tags(id),
  user_id    uuid   not null,
  live_id    bigint not null,
  kind       text   not null check (kind in ('knowledge','interest')),
  created_at timestamptz not null default now(),
  foreign key (live_id, user_id) references live_participants(live_id, user_id)
);

create index on tag_mentions (tag_id, created_at);

alter table tag_mentions enable row level security;
-- ★ ポリシーを作らない ＝ ブラウザからは一切見えない。
--   「誰が・いつ・何を話したか」の生ログなので、エージェント（service_role）だけが触る。
--   （0005 の default privileges で service_role には権限が付く）


-- ---------------------------------------------------------------------
--  既存の知見カードから埋め戻す（興味の発言は記録が無いので戻せない）
-- ---------------------------------------------------------------------
insert into tag_mentions (tag_id, user_id, live_id, kind, created_at)
select kc.tag_id, kc.speaker_id, kc.live_id, 'knowledge', kc.created_at
from knowledge_cards kc
where exists (
  select 1 from live_participants lp
  where lp.live_id = kc.live_id and lp.user_id = kc.speaker_id
)
and not exists (select 1 from tag_mentions);     -- 2回流しても増えない


-- =====================================================================
--  確認
--  期待 → RLS有効=1 ／ ポリシー=0 ／ 参加者への外部キー=1 ／ 埋め戻し件数（知見カードの数に近い）
-- =====================================================================
select
  (select count(*) from pg_class where relname = 'tag_mentions' and relrowsecurity)       as RLS有効,
  (select count(*) from pg_policies where schemaname='public' and tablename='tag_mentions') as ポリシー,
  (select count(*) from pg_constraint
    where conrelid = 'tag_mentions'::regclass and contype = 'f'
      and confrelid = 'live_participants'::regclass)                                        as 参加者への外部キー,
  (select count(*) from tag_mentions)                                                      as 埋め戻し件数;
