-- =====================================================================
--  学びの輪 — 初期データ
--  人に依存しないものだけ。ユーザーを作ったあとに走らせる必要はない
-- =====================================================================

-- ---------------------------------------------------------------------
-- ① 最初の正式タグ（コールドスタート対策の種）
--    導入時に管理者が入れる想定。デモではここから始まる
-- ---------------------------------------------------------------------
insert into tags (name, kind, status, promoted_at) values
  ('Power Apps',        '技術', 'official', now()),
  ('Power Automate',    '技術', 'official', now()),
  ('生成AI活用',        '分野', 'official', now()),
  ('プロンプト設計',    '技術', 'official', now()),
  ('データ可視化',      '分野', 'official', now()),
  ('SQL',               '技術', 'official', now()),
  ('Excel VBA',         '技術', 'official', now()),
  ('議事録の書き方',    '業務', 'official', now()),
  ('ファシリテーション','業務', 'official', now()),
  ('情報整理',          '業務', 'official', now())
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- ② 禁止リスト（門1の検査2で使う）
--    ★ 実在の顧客名は入れない。このリポジトリは public になる
--    導入時に その会社の社名・顧客名・案件コードを管理者が足す
-- ---------------------------------------------------------------------
insert into tags (name, kind, status, rejected_reason) values
  ('サンプル商事',   '分野', 'banned', '固有名詞（デモ用の例）'),
  ('サンプル物産',   '分野', 'banned', '固有名詞（デモ用の例）'),
  ('案件A',          '業務', 'banned', '案件コード（デモ用の例）')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- ③ 誤変換の寄せ先（門1の検査3で使う）
--    実際のトランスクリプトで起きた化け方を先に登録しておく
--    ここに無くても かな読みの判定で拾うが 確実なものは直接つなぐ
-- ---------------------------------------------------------------------
do $$
declare v_chiken bigint;
begin
  insert into tags (name, kind, status, promoted_at)
  values ('知見', '分野', 'official', now())
  on conflict (name) do nothing;

  select id into v_chiken from tags where name = '知見';

  insert into tags (name, kind, status, alias_of, rejected_reason) values
    ('治験',        '分野', 'rejected', v_chiken, '文字起こしの誤変換（ちけん）'),
    ('地権者',      '分野', 'rejected', v_chiken, '文字起こしの誤変換（ちけんしゃ）'),
    ('チキンラベル','分野', 'rejected', v_chiken, '文字起こしの誤変換（ちけんたぐ）')
  on conflict (name) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- ④ 管理者を1人立てる
--    Supabase の Authentication でアカウントを作ってから
--    その uuid を入れて実行する
-- ---------------------------------------------------------------------
-- insert into users (id, display_name, department, role)
-- values ('ここに auth.users の uuid', '山田 直子', '人材育成部', 'admin');

-- ---------------------------------------------------------------------
-- ⑤ デモ用の予定（★ タイトルも参加者も持たない）
--    ユーザーを作ってから uuid を差し替えて使う
-- ---------------------------------------------------------------------
-- insert into calendar_events (user_id, starts_at, ends_at, busy)
-- select 'ここに uuid',
--        d + time '10:00', d + time '11:00', true
-- from generate_series(current_date, current_date + 13, interval '1 day') d;
