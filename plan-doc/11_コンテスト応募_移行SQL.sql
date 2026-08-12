-- 11_コンテスト応募_移行SQL.sql
--
-- 目的:
-- - `users` に残っている応募属性（学校名・学年・保護者情報）を `contest_entries` に退避する
-- - `contest_entries` を現在の応募フロー（draft / submitted）に合わせる
-- - 旧 `users` の応募系カラムを削除して、アカウント情報のみ残す
--
-- 前提:
-- - `02.1_基本テーブル.sql` と `08_作品採点集計_適用SQL.sql` が適用済み
-- - `users`, `contests`, `works`, `contest_entries` が存在する
--
-- 注意:
-- - 既存データの安全性を優先し、`contest_entries` 側は NULL 許容の状態から段階的に整えます。
-- - 実行前にバックアップを取得してください。

begin;

-- ------------------------------------------------------------
-- 1. 列挙型の準備
-- ------------------------------------------------------------
do $$
begin
  create type public.guardian_consent_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 2. contest_entries を現行フロー向けに拡張
-- ------------------------------------------------------------
alter table public.contest_entries
  add column if not exists school_name varchar(100),
  add column if not exists grade varchar(10),
  add column if not exists guardian_name varchar(100),
  add column if not exists guardian_email varchar(255),
  add column if not exists guardian_phone varchar(50),
  add column if not exists guardian_consent public.guardian_consent_status not null default 'pending',
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists guardian_consent_token varchar(255),
  add column if not exists guardian_agreed_ip varchar(45),
  add column if not exists work_number int,
  add column if not exists entry_type varchar(10) not null default 'individual',
  add column if not exists team_name varchar(100),
  add column if not exists team_members text,
  add column if not exists status varchar(30) not null default 'draft',
  add column if not exists is_primary_passed boolean not null default false;

alter table public.contest_entries
  alter column work_id drop not null,
  alter column work_number drop not null,
  alter column status set default 'draft',
  alter column guardian_consent set default 'pending';

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'contest_entries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%status%'
  loop
    execute format('alter table public.contest_entries drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.contest_entries
  add constraint contest_entries_status_check
  check (status in ('draft', 'submitted', 'final_completed'));

create unique index if not exists idx_contest_entries_guardian_consent_token
  on public.contest_entries(guardian_consent_token);

create index if not exists idx_contest_entries_work_number
  on public.contest_entries(contest_id, work_number);

-- ------------------------------------------------------------
-- 3. 旧 users データの退避先を決めて contest_entries へコピー
-- ------------------------------------------------------------
do $$
declare
  target_contest_id bigint;
begin
  select contest_id
  into target_contest_id
  from public.contests
  order by
    case when status in ('accepting', 'primary_judging', 'final_judging', 'draft') then 0 else 1 end,
    year desc,
    contest_id desc
  limit 1;

  if target_contest_id is null then
    raise exception 'contests table is empty. create at least one contest before running this migration.';
  end if;

  insert into public.contest_entries (
    contest_id,
    work_id,
    user_id,
    school_name,
    grade,
    guardian_name,
    guardian_email,
    guardian_phone,
    guardian_consent,
    guardian_consent_at,
    guardian_consent_token,
    guardian_agreed_ip,
    work_number,
    entry_type,
    team_name,
    team_members,
    status,
    is_primary_passed
  )
  select
    target_contest_id,
    null,
    u.user_id,
    nullif(u.school_name, ''),
    nullif(u.grade, ''),
    nullif(u.guardian_name, ''),
    nullif(u.guardian_email, ''),
    nullif(u.guardian_phone, ''),
    coalesce(u.guardian_consent, 'pending')::public.guardian_consent_status,
    u.guardian_consent_at,
    coalesce(nullif(u.guardian_consent_token, ''), gen_random_uuid()::text),
    null,
    null,
    'individual',
    null,
    null,
    'draft',
    false
  from public.users u
  where
    exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'users' and c.column_name = 'guardian_email')
    and (
      nullif(u.school_name, '') is not null
      or nullif(u.grade, '') is not null
      or nullif(u.guardian_name, '') is not null
      or nullif(u.guardian_email, '') is not null
      or nullif(u.guardian_phone, '') is not null
      or nullif(u.guardian_consent_token, '') is not null
    )
  on conflict (contest_id, user_id) do update
    set school_name = excluded.school_name,
        grade = excluded.grade,
        guardian_name = excluded.guardian_name,
        guardian_email = excluded.guardian_email,
        guardian_phone = excluded.guardian_phone,
        guardian_consent = excluded.guardian_consent,
        guardian_consent_at = excluded.guardian_consent_at,
        guardian_consent_token = coalesce(public.contest_entries.guardian_consent_token, excluded.guardian_consent_token),
        guardian_agreed_ip = coalesce(public.contest_entries.guardian_agreed_ip, excluded.guardian_agreed_ip);
end $$;

-- ------------------------------------------------------------
-- 4. 旧 users の応募系カラムを削除
-- ------------------------------------------------------------
alter table public.users
  drop column if exists school_name,
  drop column if exists grade,
  drop column if exists guardian_name,
  drop column if exists guardian_email,
  drop column if exists guardian_phone,
  drop column if exists guardian_consent,
  drop column if exists guardian_consent_at,
  drop column if exists guardian_consent_token;

commit;
