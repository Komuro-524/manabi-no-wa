-- =====================================================================
--  学びの輪 — スキーマ
--  Supabase の SQL Editor に貼って 上から実行する
--  01 → 02 → 03 の順。02 の RLS まで通して はじめて「テーブル完成」
-- =====================================================================

-- ---------------------------------------------------------------------
-- 社員
-- ---------------------------------------------------------------------
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department   text,
  role         text not null default 'member' check (role in ('member','admin')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- タグ辞書（候補・提案・正式・弾いた・禁止 を1枚で持つ）
-- ---------------------------------------------------------------------
create table tags (
  id                bigserial primary key,
  name              text not null unique,
  kind              text not null check (kind in ('分野','技術','業務')),
  status            text not null default 'candidate'
                    check (status in ('candidate','proposed','official','rejected','banned')),
  mention_count     int  not null default 0,
  last_mentioned_at timestamptz,
  last_live_at      timestamptz,
  alias_of          bigint references tags(id),   -- 空似の寄せ先
  rejected_reason   text,
  proposed_at       timestamptz,
  promoted_at       timestamptz,
  reviewed_by       uuid references users(id),
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now()
);
create index tags_status_idx on tags (status);

-- ---------------------------------------------------------------------
-- まなびのライブ（1回が1行。取り込み単位でもある）
-- ---------------------------------------------------------------------
create table lives (
  id              bigserial primary key,
  title           text,
  topic_tag_id    bigint references tags(id),
  quest_id        bigint,                         -- quests 作成後に FK を張る
  status          text not null default 'scheduled'
                  check (status in ('scheduled','live','ended','cancelled')),
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  source_ref      text unique,                    -- ★ 音声トランスクリプトID。二重取り込みを弾く
  ingest_status   text not null default 'pending'
                  check (ingest_status in ('pending','running','done','failed')),
  created_at      timestamptz not null default now()
);
create index lives_status_idx  on lives (status, scheduled_start);
create index lives_ingest_idx  on lives (ingest_status) where ingest_status = 'pending';

-- ---------------------------------------------------------------------
-- 招待と参加（★ 行があれば 過去の会話を読める）
-- ---------------------------------------------------------------------
create table live_participants (
  live_id    bigint not null references lives(id) on delete cascade,
  user_id    uuid   not null references users(id) on delete cascade,
  role       text check (role in ('speaker','listener')),   -- 参加したら決まる
  invited_at timestamptz,
  joined_at  timestamptz,
  primary key (live_id, user_id)
);
create index live_participants_user_idx on live_participants (user_id);

-- ---------------------------------------------------------------------
-- リスナーのコメント
-- ---------------------------------------------------------------------
create table messages (
  id         bigserial primary key,
  live_id    bigint not null references lives(id) on delete cascade,
  user_id    uuid references users(id) default auth.uid(),  -- AIの発言なら null
  body       text not null,
  is_agent   boolean not null default false,                -- ★ A は false だけ読む
  created_at timestamptz not null default now()
);
create index messages_live_idx on messages (live_id, created_at);

-- ---------------------------------------------------------------------
-- 知見カード（タグと1対1・話した人が付く）
-- ---------------------------------------------------------------------
create table knowledge_cards (
  id           bigserial primary key,
  live_id      bigint not null references lives(id) on delete cascade,
  tag_id       bigint not null references tags(id),   -- ★ 辞書外は入らない
  speaker_id   uuid   not null references users(id),
  headline     text not null,
  body         text not null,                         -- ★ 逐語引用しない。要約する
  verification text not null default 'unverified'
               check (verification in ('unverified','verified','rejected')),
  confidence   numeric(3,2),
  view_count   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index knowledge_cards_tag_idx     on knowledge_cards (tag_id);
create index knowledge_cards_speaker_idx on knowledge_cards (speaker_id);

-- ---------------------------------------------------------------------
-- 人に付いたタグ（知見と興味を1枚で）
-- ---------------------------------------------------------------------
create table user_tags (
  id           bigserial primary key,
  user_id      uuid   not null references users(id) on delete cascade,
  tag_id       bigint not null references tags(id),
  kind         text not null check (kind in ('knowledge','interest')),
  strength     numeric(5,2) not null default 0,
  answer_count int  not null default 0,          -- 他人に答えた実績
  source       text not null check (source in ('live','self','manual')),
  visibility   text not null default 'public' check (visibility in ('public','private')),
  expires_at   timestamptz,                      -- 賞味期限つき興味タグ
  updated_at   timestamptz not null default now(),
  unique (user_id, tag_id, kind)
);
create index user_tags_tag_idx on user_tags (tag_id, kind);

-- ---------------------------------------------------------------------
-- 企て（③と④の主役）
-- ---------------------------------------------------------------------
create table quests (
  id                bigserial primary key,
  tag_id            bigint not null references tags(id),
  previous_quest_id bigint references quests(id),
  status            text not null default 'scouting'
                    check (status in ('skipped','scouting','inviting','scheduling',
                                      'opened','done','abandoned')),
  interested_ids    uuid[] not null default '{}',
  current_invitee   uuid references users(id),
  tried_count       int not null default 0,
  live_id           bigint references lives(id),
  next_action_at    timestamptz,
  reevaluate_at     timestamptz,
  attendee_count    int,
  message_count     int,
  cards_created     int,
  encore_count      int,
  outcome           text,
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);

-- ★ タグごとに 進行中の企ては1つまで（毎日同じ部屋が立つのを防ぐ）
create unique index quests_one_active_per_tag
  on quests (tag_id)
  where status in ('scouting','inviting','scheduling','opened');

create index quests_next_action_idx on quests (next_action_at)
  where status in ('scouting','inviting','scheduling','opened');

-- lives → quests の FK を後から張る
alter table lives
  add constraint lives_quest_fk foreign key (quest_id) references quests(id);

-- ---------------------------------------------------------------------
-- 判断ログ（★ 立てなかった理由もここ）
-- ---------------------------------------------------------------------
create table quest_steps (
  id         bigserial primary key,
  quest_id   bigint not null references quests(id) on delete cascade,
  kind       text not null,     -- judge / invite / remind / giveup / schedule / open / nudge
  decision   text not null,     -- open / wait / skip ...
  reason     text not null,
  model      text,
  cost_usd   numeric(10,6),
  created_at timestamptz not null default now()
);
create index quest_steps_quest_idx on quest_steps (quest_id, created_at);

-- ---------------------------------------------------------------------
-- 打診
-- ---------------------------------------------------------------------
create table invitations (
  id           bigserial primary key,
  quest_id     bigint not null references quests(id) on delete cascade,
  user_id      uuid   not null references users(id),
  status       text not null default 'sent'
               check (status in ('sent','accepted','declined','expired')),
  sent_at      timestamptz not null default now(),
  responded_at timestamptz
);
create index invitations_user_idx on invitations (user_id, sent_at);

-- ---------------------------------------------------------------------
-- 予定（★ タイトルも参加者も持たない。空き／埋まりだけ）
-- ---------------------------------------------------------------------
create table calendar_events (
  id        bigserial primary key,
  user_id   uuid not null references users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  busy      boolean not null default true
);
create index calendar_events_user_idx on calendar_events (user_id, starts_at);

-- ---------------------------------------------------------------------
-- エージェントの実行記録（②のレシートと ③の再開）
-- ---------------------------------------------------------------------
create table agent_runs (
  id            bigserial primary key,
  agent         text not null check (agent in ('A','B','C')),
  trigger       text not null,
  status        text not null default 'running'
                check (status in ('running','succeeded','failed')),
  ref_id        text,
  model         text,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10,6),
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index agent_runs_agent_idx on agent_runs (agent, started_at);

-- ---------------------------------------------------------------------
-- 自己分析セッション（★ 画像は持たない）
-- ---------------------------------------------------------------------
create table self_analysis_sessions (
  id            bigserial primary key,
  user_id       uuid not null references users(id) on delete cascade,
  granularity   text not null default 'window' check (granularity in ('window','screen')),
  frame_count   int not null default 0,
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null,        -- ★ 開始時に終了時刻を宣言する
  finished_at   timestamptz
);

-- =====================================================================
--  ここまででテーブルはできたが まだ「完成」ではない。
--  02_rls.sql を必ず続けて実行すること。
-- =====================================================================
