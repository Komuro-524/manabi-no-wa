-- =====================================================================
--  育ちかけのタグへの「タグにしてほしい」申請（9/21 小室さんとの画面確認より）
--
--  背景:
--    格上げ候補の条件は「直近30日に延べ3回 または 2人以上」。
--    少ない人しか知らないけれど価値のある知識は、この条件になかなか届かない。
--    話した本人が「これは価値がある」と思ったら申請でき、管理者のタグ帳で上に出るようにする。
--
--  方針:
--    ・申請できるのは、自分の user_tags にある 育ちかけ（candidate / proposed）のタグだけ
--    ・申請は並び順と表示を変えるだけ。★ 正式にするのは今まで通り管理者の承認だけ
--    ・書き込みは関数 request_tag() だけ（ブラウザ向けの insert / delete ポリシーは作らない）
--    ・読めるのは 自分の申請 と 管理者
--    ・2回流しても壊れない（if not exists / create or replace）
-- =====================================================================
begin;

create table if not exists tag_requests (
  tag_id     bigint not null references tags(id),
  user_id    uuid   not null references users(id),
  created_at timestamptz not null default now(),
  primary key (tag_id, user_id)
);
create index if not exists tag_requests_user_idx on tag_requests (user_id);

alter table tag_requests enable row level security;

drop policy if exists "自分の申請と管理者だけ読める" on tag_requests;
create policy "自分の申請と管理者だけ読める" on tag_requests
  for select to authenticated using (user_id = auth.uid() or is_admin());

-- 申請する（p_on = true）／取り下げる（p_on = false）。自分の分しか動かせない
create or replace function request_tag(p_tag_id bigint, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_on then
    if not exists (
      select 1 from user_tags ut join tags t on t.id = ut.tag_id
      where ut.user_id = auth.uid() and ut.tag_id = p_tag_id
        and t.status in ('candidate', 'proposed')
    ) then
      raise exception '申請できるのは、あなたに付いている育ちかけのタグだけです';
    end if;
    insert into tag_requests (tag_id, user_id) values (p_tag_id, auth.uid())
    on conflict do nothing;
  else
    delete from tag_requests where tag_id = p_tag_id and user_id = auth.uid();   -- ★ 自分の申請だけ
  end if;
end;
$$;

revoke all on function request_tag(bigint, boolean) from public;
grant execute on function request_tag(bigint, boolean) to authenticated;
grant select on tag_requests to authenticated;

commit;

-- =====================================================================
--  確認  期待 → RLS有効=1 ／ ポリシー=1（selectだけ） ／ 関数=1
-- =====================================================================
select
  (select count(*) from pg_class where relname = 'tag_requests' and relrowsecurity)          as RLS有効,
  (select count(*) from pg_policies where schemaname='public' and tablename='tag_requests')   as ポリシー,
  (select count(*) from pg_proc where proname = 'request_tag')                               as 関数;
