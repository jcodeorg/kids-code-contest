-- 目的:
-- 1) users.user_id を auth.users.id と揃える（可能な行のみ）
-- 2) users を「本人のみ参照可」にする RLS を適用
-- 3) invites / invite_usages の直接参照を禁止（API 経由のみ）
--
-- 実行前に必ずバックアップを取得してください。

begin;

-- ------------------------------------------------------------
-- A. 既存データ整合: users.user_id を auth.users.id に寄せる
-- ------------------------------------------------------------
-- 注: 既存FK影響を避けるため、参照先テーブルも同時更新します。
--     ここでは現行実装で使用している invite_usages / invites のみ対象。

do $$
declare
  r record;
begin
  for r in
    select
      u.user_id as old_user_id,
      au.id as new_user_id
    from public.users u
    join auth.users au
      on lower(au.email) = lower(u.email)
    where u.user_id <> au.id
      and not exists (
        select 1
        from public.users u2
        where u2.user_id = au.id
      )
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'invite_usages'
    ) then
      update public.invite_usages
      set used_by_user_id = r.new_user_id
      where used_by_user_id = r.old_user_id;
    end if;

    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'invites'
    ) then
      update public.invites
      set created_by_user_id = r.new_user_id
      where created_by_user_id = r.old_user_id;
    end if;

    update public.users
    set user_id = r.new_user_id
    where user_id = r.old_user_id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- B. RLS 有効化
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.invites enable row level security;
alter table public.invite_usages enable row level security;

-- ------------------------------------------------------------
-- C. 既存 policy を掃除（再実行可能にする）
-- ------------------------------------------------------------
drop policy if exists users_select_own on public.users;
drop policy if exists users_select_admin on public.users;
drop policy if exists invites_none_client on public.invites;
drop policy if exists invite_usages_none_client on public.invite_usages;

-- ------------------------------------------------------------
-- D. users policy
-- ------------------------------------------------------------
-- 本人の行だけ参照可能
create policy users_select_own
on public.users
for select
to authenticated
using (user_id = auth.uid());

-- 管理者は全件参照可（必要な場合）
-- 注意: この policy は users テーブル自己参照を含みます。
-- Supabase/Postgres で問題なく動くケースが多いですが、
-- 環境により再帰エラーが出る場合は SQL function 化してください。
create policy users_select_admin
on public.users
for select
to authenticated
using (
  exists (
    select 1
    from public.users me
    where me.user_id = auth.uid()
      and me.role = 'admin'
  )
);

-- ------------------------------------------------------------
-- E. invites / invite_usages policy
-- ------------------------------------------------------------
-- クライアントから直接参照させない（server role API 経由のみ）
create policy invites_none_client
on public.invites
for all
to authenticated
using (false)
with check (false);

create policy invite_usages_none_client
on public.invite_usages
for all
to authenticated
using (false)
with check (false);

commit;

-- ------------------------------------------------------------
-- 動作確認クエリ（参考）
-- ------------------------------------------------------------
-- 1) 自分の users 行だけ見えるか
-- select user_id, email, role from public.users;
--
-- 2) invites が直接見えないか（client では 0 row / permission denied になること）
-- select * from public.invites;
