-- =====================================================================
--  文字起こしを「名前の文字列」から「アカウント」に変える
--
--  背景:
--    これまでAは文字起こしのテキストから話者名を読み取り、社員名簿と
--    突き合わせて speaker_id を決めていた。つまり
--    「文字列を1行書き足せば 他人の名義で知見カードが作れる」状態だった。
--
--  方針:
--    まなびのライブは 参加者がそれぞれ自分のアカウントで入る。
--    だから「どのアカウントの音声か」は 音声が発生した時点で確定している。
--    文字起こしは最初から user_id を持つ行の集まりとして保存する。
--    ★ Aは名前を一度も見ない。speaker_id は行が持っているものをそのまま使う。
--
--  ★ (live_id, user_id) を live_participants への複合外部キーにしてある。
--    その場にいない人の発言は DBの制約として存在できない。
-- =====================================================================

create table transcript_segments (
  id        bigserial primary key,
  live_id   bigint not null,
  user_id   uuid   not null,          -- ★ 音声が入った時点で確定する。推測しない
  seq       int    not null,          -- ライブ内の通し番号。LLMにはこの番号だけ見せる
  spoken_at timestamptz,
  body      text   not null,

  -- ★ 参加者以外の発言は作れない（なりすましを制約で殺す）
  foreign key (live_id, user_id) references live_participants(live_id, user_id),
  unique (live_id, seq)
);

create index on transcript_segments (live_id, seq);

alter table transcript_segments enable row level security;

-- 元発言は 誘われた人だけ読める（messages と同じ考え方）
create policy "誘われた人だけ読める" on transcript_segments
  for select to authenticated
  using (exists (
    select 1 from live_participants lp
    where lp.live_id = transcript_segments.live_id and lp.user_id = auth.uid()
  ));

-- ★ insert / update ポリシーは作らない
--   音声セグメントを作れるのはライブ本体（service_role）だけ。
--   ブラウザから発言を後から差し込めない。

grant select on transcript_segments to authenticated;
-- insert は渡さない（0005 の default privileges で service_role には付く）


-- =====================================================================
--  確認
--  期待 → 3列とも 1
-- =====================================================================
select
  (select count(*) from pg_class
    where relname = 'transcript_segments' and relrowsecurity)              as RLS有効,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'transcript_segments')     as ポリシー,
  (select count(*) from pg_constraint
    where conrelid = 'transcript_segments'::regclass and contype = 'f'
      and confrelid = 'live_participants'::regclass)                       as 参加者への外部キー;
