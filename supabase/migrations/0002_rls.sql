-- =====================================================================
--  学びの輪 — RLS（行レベルセキュリティ）
--  01 の直後に必ず実行する。あとから足すと必ず漏れる
--
--  考え方
--   ・ポリシーを作らない ＝ ブラウザからは一切さわれない
--   ・service_role（サーバー側のエージェント）は RLS を素通りする
--   ・★ update ポリシーは「どの行を」しか縛れず「どの列を」は縛れない
--     → 列を守りたいものは update ポリシーを作らず 関数（RPC）にする
-- =====================================================================

alter table users                  enable row level security;
alter table tags                   enable row level security;
alter table lives                  enable row level security;
alter table live_participants      enable row level security;
alter table messages               enable row level security;
alter table knowledge_cards        enable row level security;
alter table user_tags              enable row level security;
alter table quests                 enable row level security;
alter table quest_steps            enable row level security;
alter table invitations            enable row level security;
alter table calendar_events        enable row level security;
alter table agent_runs             enable row level security;
alter table self_analysis_sessions enable row level security;

-- ---------------------------------------------------------------------
-- 管理者かどうかを1か所で判定する
-- ---------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- users：読むだけ
--   ★ update ポリシーは意図的に作らない
--     作ると 一般社員が update users set role='admin' で管理者になれる
--   表示名の変更が要るなら サーバー側(API Route)を通すこと
-- ---------------------------------------------------------------------
create policy "社員は全員読める" on users
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- tags：正式タグは全員／候補・提案・弾いた語は管理者だけ
-- ---------------------------------------------------------------------
create policy "正式タグは全員 それ以外は管理者" on tags
  for select to authenticated
  using (status = 'official' or is_admin());

create policy "管理者だけタグを裁ける" on tags
  for update to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------
-- lives / live_participants：一覧は全員に見える
-- ---------------------------------------------------------------------
create policy "ライブは全員見える" on lives
  for select to authenticated using (true);

create policy "参加者は全員見える" on live_participants
  for select to authenticated using (true);

-- ★ 終了したライブには誰も入れない（過去ログが後から広がらない）
create policy "開催中のライブにだけ参加できる" on live_participants
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from lives l where l.id = live_id and l.status = 'live')
  );

-- ---------------------------------------------------------------------
-- messages：誘われた人だけが元発言を読める
-- ---------------------------------------------------------------------
create policy "誘われた人だけ読める" on messages
  for select to authenticated
  using (exists (
    select 1 from live_participants lp
    where lp.live_id = messages.live_id and lp.user_id = auth.uid()
  ));

create policy "自分としてだけ投稿できる" on messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_agent = false
    and exists (select 1 from lives l where l.id = live_id and l.status = 'live')
  );

-- ---------------------------------------------------------------------
-- knowledge_cards：全社公開（本文は要約なので出してよい）
--   書き込みは 🎙️A だけ ＝ insert/update ポリシーを作らない
-- ---------------------------------------------------------------------
create policy "知見カードは全員読める" on knowledge_cards
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- user_tags：公開は全員／非公開は本人だけ
--   ★ update ポリシーは作らない
--     作ると strength や answer_count を自分で盛れてしまう
--     公開設定の変更だけ 下の関数で許可する
-- ---------------------------------------------------------------------
create policy "公開は全員 非公開は本人だけ" on user_tags
  for select to authenticated
  using (visibility = 'public' or user_id = auth.uid());

create or replace function set_tag_visibility(
  p_tag_id     bigint,
  p_kind       text,
  p_visibility text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visibility not in ('public','private') then
    raise exception '不正な公開設定です';
  end if;

  update user_tags
     set visibility = p_visibility,
         updated_at = now()
   where user_id = auth.uid()          -- ★ 自分の行しか動かせない
     and tag_id  = p_tag_id
     and kind    = p_kind;
end;
$$;

revoke all on function set_tag_visibility(bigint, text, text) from public;
grant execute on function set_tag_visibility(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- invitations：自分宛だけ見える
--   ★ ここも update ポリシーを作らない
--     作ると quest_id を書き換えて 他人の企てに割り込める
--     返事は下の関数だけで受ける
-- ---------------------------------------------------------------------
create policy "自分宛の打診だけ見える" on invitations
  for select to authenticated using (user_id = auth.uid());

create or replace function respond_invitation(
  p_invitation_id bigint,
  p_accept        boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invitations
     set status       = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id      = p_invitation_id
     and user_id = auth.uid()          -- ★ 自分宛しか答えられない
     and status  = 'sent';             -- ★ 一度答えたら変えられない

  if not found then
    raise exception 'この打診には答えられません';
  end if;
end;
$$;

revoke all on function respond_invitation(bigint, boolean) from public;
grant execute on function respond_invitation(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- calendar_events：本人だけ
--   他人の空き時間が見えるのは それ自体が漏洩
--   日程調整は service_role で動く 🎪B だけがやる
-- ---------------------------------------------------------------------
create policy "自分の予定だけ見える" on calendar_events
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- self_analysis_sessions：本人だけ
-- ---------------------------------------------------------------------
create policy "自分の記録だけ見える" on self_analysis_sessions
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- quests / quest_steps / agent_runs
--   ★ ポリシーを1つも作らない ＝ ブラウザからは一切見えない
--     エージェント（service_role）だけが触る
-- ---------------------------------------------------------------------

-- =====================================================================
--  ここまで通ったら checks.sql で確かめる。
--  確認まで終わって はじめて「テーブル完成」
-- =====================================================================
