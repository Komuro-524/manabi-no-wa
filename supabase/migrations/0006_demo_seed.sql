-- =====================================================================
--  学びの輪 — デモ用の社員データ（🎪B 場づくりのための候補者データ）
--
--  B は「興味タグを持つ人」がいないと何も判断できない。
--  このマイグレーションは架空の社員10人と、知見・興味タグを投入する。
--
--  ★ 実在の会社名・顧客名・実在の人名は一切使っていない。すべて架空。
--  ★ 冪等（何度流しても増えない）。 id / unique 制約で ON CONFLICT DO NOTHING
--
--  実行順序: 0001〜0005 のあと。SQL Editor に貼って実行する。
--  （service_role 相当のロールで動くので auth.users にも直接書ける）
-- =====================================================================

-- ---------------------------------------------------------------------
-- ① 認証ユーザー（auth.users）
--    display_name はあとで public.users に入れる。
--    ログインさせる想定ではないのでパスワードはダミー固定文字列。
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '226578cf-8980-4829-806c-d3510fee6238', 'authenticated', 'authenticated', 'demo-hoshino@example.invalid',   crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '16be614b-ca9f-4477-a093-ac40962ff47e', 'authenticated', 'authenticated', 'demo-sakuraba@example.invalid',   crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd7cac38d-592d-406a-bc61-2e195e31c6cf', 'authenticated', 'authenticated', 'demo-matsunaga@example.invalid',  crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '4cb42a58-168e-425d-a365-d88b46980b85', 'authenticated', 'authenticated', 'demo-kamiya@example.invalid',     crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '1c92b672-c65a-48c1-8ce3-e2c602793783', 'authenticated', 'authenticated', 'demo-hayasaka@example.invalid',   crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd', 'authenticated', 'authenticated', 'demo-chiba@example.invalid',      crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b7a4ce7b-d376-48ed-926e-ff04641f49ec', 'authenticated', 'authenticated', 'demo-ayase@example.invalid',      crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'df7f9bc2-562b-4934-89f1-ec97e0ed7913', 'authenticated', 'authenticated', 'demo-fujishiro@example.invalid',  crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '88feab1d-0154-468b-827e-e737cc0f8680', 'authenticated', 'authenticated', 'demo-gunji@example.invalid',      crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '82f1809b-9a03-435f-8c81-0dbf089a7d29', 'authenticated', 'authenticated', 'demo-shiraishi@example.invalid',  crypt('demo-seed-not-a-real-login', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- 対応する identity（無くても users テーブル用途には支障ないが、
-- 認証まわりの整合性を崩さないために念のため入れておく）
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now()
from auth.users u
where u.email like 'demo-%@example.invalid'
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------
-- ② 社員名簿（public.users）— 架空の社員10人
-- ---------------------------------------------------------------------
insert into users (id, display_name, department, role) values
  ('226578cf-8980-4829-806c-d3510fee6238', '星野 陸',   '営業部',       'member'),
  ('16be614b-ca9f-4477-a093-ac40962ff47e', '桜庭 芽衣', '開発部',       'member'),
  ('d7cac38d-592d-406a-bc61-2e195e31c6cf', '松永 蒼',   '人事部',       'member'),
  ('4cb42a58-168e-425d-a365-d88b46980b85', '神谷 美月', '経理部',       'member'),
  ('1c92b672-c65a-48c1-8ce3-e2c602793783', '早坂 悠人', '開発部',       'member'),
  ('5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd', '千葉 陽菜', 'マーケティング部', 'member'),
  ('b7a4ce7b-d376-48ed-926e-ff04641f49ec', '綾瀬 大輝', '情報システム部', 'member'),
  ('df7f9bc2-562b-4934-89f1-ec97e0ed7913', '藤代 咲良', '総務部',       'member'),
  ('88feab1d-0154-468b-827e-e737cc0f8680', '郡司 蓮',   '開発部',       'member'),
  ('82f1809b-9a03-435f-8c81-0dbf089a7d29', '白石 結衣', '企画部',       'member')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- ③ 知見・興味タグ（user_tags）
--    ★ タグは自由文にしない。tags 辞書から名前で引く（辞書外は入らない）
--
--    狙い（🎪Bが判断材料にできるように 山と谷を作る）:
--      ・Power Automate / 生成AI活用 / エージェント設計 → 興味も知見も厚い（open 向き）
--      ・データ可視化                                    → 興味はあるが答えられる人がいない（wait 向き）
--      ・議事録の書き方                                  → 知見はあるが興味が誰にも無い（skip 向き）
-- ---------------------------------------------------------------------
insert into user_tags (user_id, tag_id, kind, strength, answer_count, source, visibility)
select v.user_id, t.id, v.kind, v.strength, v.answer_count, 'manual', 'public'
from (values
  -- Power Automate（知見1 + 興味3）
  ('b7a4ce7b-d376-48ed-926e-ff04641f49ec'::uuid, 'Power Automate', 'knowledge', 8.0, 5),
  ('226578cf-8980-4829-806c-d3510fee6238'::uuid, 'Power Automate', 'interest',  2.0, 0),
  ('4cb42a58-168e-425d-a365-d88b46980b85'::uuid, 'Power Automate', 'interest',  2.0, 0),
  ('1c92b672-c65a-48c1-8ce3-e2c602793783'::uuid, 'Power Automate', 'interest',  3.0, 0),

  -- プロンプト設計（知見1 + 興味2）
  ('88feab1d-0154-468b-827e-e737cc0f8680'::uuid, 'プロンプト設計', 'knowledge', 6.0, 3),
  ('16be614b-ca9f-4477-a093-ac40962ff47e'::uuid, 'プロンプト設計', 'interest',  2.0, 0),
  ('5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd'::uuid, 'プロンプト設計', 'interest',  2.0, 0),

  -- データ可視化（興味1のみ。答えられる人がいない＝wait向き）
  ('df7f9bc2-562b-4934-89f1-ec97e0ed7913'::uuid, 'データ可視化', 'interest', 1.0, 0),

  -- 議事録の書き方（知見1のみ。興味が誰にも無い＝skip向き）
  ('d7cac38d-592d-406a-bc61-2e195e31c6cf'::uuid, '議事録の書き方', 'knowledge', 3.0, 1),

  -- エージェント設計（候補タグ。0002番タスクで official 昇格する想定。知見1 + 興味3）
  ('16be614b-ca9f-4477-a093-ac40962ff47e'::uuid, 'エージェント設計', 'knowledge', 5.0, 2),
  ('82f1809b-9a03-435f-8c81-0dbf089a7d29'::uuid, 'エージェント設計', 'interest',  3.0, 0),
  ('1c92b672-c65a-48c1-8ce3-e2c602793783'::uuid, 'エージェント設計', 'interest',  2.0, 0),
  ('88feab1d-0154-468b-827e-e737cc0f8680'::uuid, 'エージェント設計', 'interest',  2.0, 0),

  -- 生成AI活用（知見1 + 興味5。全社的に関心が厚い想定）
  ('1c92b672-c65a-48c1-8ce3-e2c602793783'::uuid, '生成AI活用', 'knowledge', 7.0, 4),
  ('226578cf-8980-4829-806c-d3510fee6238'::uuid, '生成AI活用', 'interest',  1.0, 0),
  ('d7cac38d-592d-406a-bc61-2e195e31c6cf'::uuid, '生成AI活用', 'interest',  1.0, 0),
  ('4cb42a58-168e-425d-a365-d88b46980b85'::uuid, '生成AI活用', 'interest',  1.0, 0),
  ('df7f9bc2-562b-4934-89f1-ec97e0ed7913'::uuid, '生成AI活用', 'interest',  1.0, 0),
  ('82f1809b-9a03-435f-8c81-0dbf089a7d29'::uuid, '生成AI活用', 'interest',  2.0, 0),

  -- SQL（知見1 + 興味1）
  ('4cb42a58-168e-425d-a365-d88b46980b85'::uuid, 'SQL', 'knowledge', 5.0, 2),
  ('b7a4ce7b-d376-48ed-926e-ff04641f49ec'::uuid, 'SQL', 'interest',  1.0, 0)
) as v(user_id, tag_name, kind, strength, answer_count)
join tags t on t.name = v.tag_name
on conflict (user_id, tag_id, kind) do nothing;

-- =====================================================================
--  確認：ここまで全部通ったか1発で見る
--  期待 → 社員10 ／ user_tags 21
-- =====================================================================
select
  (select count(*) from users where display_name in (
    '星野 陸','桜庭 芽衣','松永 蒼','神谷 美月','早坂 悠人',
    '千葉 陽菜','綾瀬 大輝','藤代 咲良','郡司 蓮','白石 結衣'
  ))                                                            as 社員,
  (select count(*) from user_tags ut
     join users u on u.id = ut.user_id
    where u.display_name in (
      '星野 陸','桜庭 芽衣','松永 蒼','神谷 美月','早坂 悠人',
      '千葉 陽菜','綾瀬 大輝','藤代 咲良','郡司 蓮','白石 結衣'
    ))                                                          as タグ付け;
