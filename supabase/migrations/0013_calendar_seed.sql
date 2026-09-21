-- =====================================================================
--  架空社員のダミー予定（F11。§5のcalendarをP1に格上げ）
--
--  ★ ルール11: free/busyだけ。タイトルも参加者も持たない。
--  ★ 0006_demo_seed.sql で投入した架空社員10人が対象（実在の社員は含めない）。
--
--  狙い:
--    全員「明日15:00-16:00」を埋めておく（よくある定例会議のイメージ）。
--    organizer.mjs の pickFreeSlot() は毎日15:00-16:00から順に空きを探すため、
--    この予定があることで「1日目は埋まっているので2日目にずれる」という
--    free/busyを見て日程をずらす様子が実際に確認できる。
--    そのほかにも数枠、2週間の範囲にランダムな予定を散らして厚みを持たせる。
--
--  ★ 時刻はすべて日本時間で解釈する（Supabaseのセッションは UTC なので、
--    current_date + time '15:00' だと日本時間の深夜0:00になってしまう）。
--
--  ★ 2回流しても増えないように、対象社員の既存の予定を一度消してから入れ直す
--    （delete + insert。架空社員10人の calendar_events だけが対象）。
-- =====================================================================

begin;

delete from calendar_events
where user_id in (
  '226578cf-8980-4829-806c-d3510fee6238', '16be614b-ca9f-4477-a093-ac40962ff47e',
  'd7cac38d-592d-406a-bc61-2e195e31c6cf', '4cb42a58-168e-425d-a365-d88b46980b85',
  '1c92b672-c65a-48c1-8ce3-e2c602793783', '5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd',
  'b7a4ce7b-d376-48ed-926e-ff04641f49ec', 'df7f9bc2-562b-4934-89f1-ec97e0ed7913',
  '88feab1d-0154-468b-827e-e737cc0f8680', '82f1809b-9a03-435f-8c81-0dbf089a7d29'
);

-- ① 全員「明日15:00-16:00」が埋まっている（定例会議のイメージ）
insert into calendar_events (user_id, starts_at, ends_at, busy)
select u.id,
       (((now() at time zone 'Asia/Tokyo')::date + 1) + time '15:00') at time zone 'Asia/Tokyo',
       (((now() at time zone 'Asia/Tokyo')::date + 1) + time '16:00') at time zone 'Asia/Tokyo',
       true
from (values
  ('226578cf-8980-4829-806c-d3510fee6238'::uuid), ('16be614b-ca9f-4477-a093-ac40962ff47e'::uuid),
  ('d7cac38d-592d-406a-bc61-2e195e31c6cf'::uuid), ('4cb42a58-168e-425d-a365-d88b46980b85'::uuid),
  ('1c92b672-c65a-48c1-8ce3-e2c602793783'::uuid), ('5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd'::uuid),
  ('b7a4ce7b-d376-48ed-926e-ff04641f49ec'::uuid), ('df7f9bc2-562b-4934-89f1-ec97e0ed7913'::uuid),
  ('88feab1d-0154-468b-827e-e737cc0f8680'::uuid), ('82f1809b-9a03-435f-8c81-0dbf089a7d29'::uuid)
) as u(id);

-- ② ばらつきを出すための追加の予定（曜日・時間はランダム。2週間の範囲・タイトル無し）
insert into calendar_events (user_id, starts_at, ends_at, busy)
select u.id,
       (((now() at time zone 'Asia/Tokyo')::date + d) + time '10:00') at time zone 'Asia/Tokyo',
       (((now() at time zone 'Asia/Tokyo')::date + d) + time '11:00') at time zone 'Asia/Tokyo',
       true
from (values
  ('226578cf-8980-4829-806c-d3510fee6238'::uuid), ('16be614b-ca9f-4477-a093-ac40962ff47e'::uuid),
  ('d7cac38d-592d-406a-bc61-2e195e31c6cf'::uuid), ('4cb42a58-168e-425d-a365-d88b46980b85'::uuid),
  ('1c92b672-c65a-48c1-8ce3-e2c602793783'::uuid), ('5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd'::uuid),
  ('b7a4ce7b-d376-48ed-926e-ff04641f49ec'::uuid), ('df7f9bc2-562b-4934-89f1-ec97e0ed7913'::uuid),
  ('88feab1d-0154-468b-827e-e737cc0f8680'::uuid), ('82f1809b-9a03-435f-8c81-0dbf089a7d29'::uuid)
) as u(id)
cross join (values (3), (7)) as d(d);

commit;

-- =====================================================================
--  確認
--  期待 → 架空社員10人 × 3件（15:00枠1件 + 10:00枠2件）= 30件
-- =====================================================================
select count(*) as calendar_events件数
from calendar_events
where user_id in (
  '226578cf-8980-4829-806c-d3510fee6238', '16be614b-ca9f-4477-a093-ac40962ff47e',
  'd7cac38d-592d-406a-bc61-2e195e31c6cf', '4cb42a58-168e-425d-a365-d88b46980b85',
  '1c92b672-c65a-48c1-8ce3-e2c602793783', '5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd',
  'b7a4ce7b-d376-48ed-926e-ff04641f49ec', 'df7f9bc2-562b-4934-89f1-ec97e0ed7913',
  '88feab1d-0154-468b-827e-e737cc0f8680', '82f1809b-9a03-435f-8c81-0dbf089a7d29'
);

-- 日本時間で見た予定（期待 → 明日15:00が10件、3日後と7日後の10:00が10件ずつ）
select to_char(starts_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') as 開始_日本時間,
       count(*) as 人数
from calendar_events
where user_id in (
  '226578cf-8980-4829-806c-d3510fee6238', '16be614b-ca9f-4477-a093-ac40962ff47e',
  'd7cac38d-592d-406a-bc61-2e195e31c6cf', '4cb42a58-168e-425d-a365-d88b46980b85',
  '1c92b672-c65a-48c1-8ce3-e2c602793783', '5ab440b6-c7cf-4dc2-b05d-730cc3d3dadd',
  'b7a4ce7b-d376-48ed-926e-ff04641f49ec', 'df7f9bc2-562b-4934-89f1-ec97e0ed7913',
  '88feab1d-0154-468b-827e-e737cc0f8680', '82f1809b-9a03-435f-8c81-0dbf089a7d29'
)
group by 1
order by 1;
