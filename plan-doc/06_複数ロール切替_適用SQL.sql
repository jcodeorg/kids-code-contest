-- 複数ロール割り当て & 動的ロール切替 追加SQL
-- 既存 users テーブルを壊さずに段階適用できるよう IF NOT EXISTS を多用

BEGIN;

-- 1) ロールマスター
CREATE TABLE IF NOT EXISTS roles (
    role_id VARCHAR(30) PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (role_id, role_name) VALUES
('applicant',     '応募者'),
('staff',         '一次採点スタッフ'),
('contest_admin', 'コンテスト管理者'),
('staff_primary', '一次採点スタッフ(旧)'),
('staff_manager', '集計管理スタッフ(旧)'),
('judge',         '審査員'),
('admin',         'システム管理者')
ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name;

-- 2) users.current_role_id 追加
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_role_id VARCHAR(30);

-- デフォルト設定（未設定ユーザーは applicant）
ALTER TABLE users
ALTER COLUMN current_role_id SET DEFAULT 'applicant';

UPDATE users
SET current_role_id = COALESCE(current_role_id, role::text, 'applicant')
WHERE current_role_id IS NULL;

-- NOT NULL 化
ALTER TABLE users
ALTER COLUMN current_role_id SET NOT NULL;

-- 外部キー制約（未作成時のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_current_role'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_current_role
      FOREIGN KEY (current_role_id)
      REFERENCES roles(role_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) user_roles テーブル
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL,
    role_id VARCHAR(30) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user
      FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role
      FOREIGN KEY (role_id)
      REFERENCES roles(role_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- 4) 既存 role 列から user_roles へ移行
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, COALESCE(u.role::text, 'applicant')
FROM users u
ON CONFLICT (user_id, role_id) DO NOTHING;

-- current_role_id も必ず user_roles に存在させる
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, COALESCE(u.current_role_id, 'applicant')
FROM users u
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 5) ENUM依存の最終整理（users.role / invites.target_role）
-- users.role は旧ENUM(user_role)依存のため、必要に応じて削除する。
-- 先に current_role_id と user_roles が運用されていることを確認してから実行。
ALTER TABLE users
DROP COLUMN IF EXISTS role;

-- invites.target_role が ENUM(user_role) の場合に text へ変更
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invites'
      AND column_name = 'target_role'
      AND udt_name = 'user_role'
  ) THEN
    ALTER TABLE invites
      ALTER COLUMN target_role TYPE VARCHAR(30)
      USING target_role::text;
  END IF;
END $$;

-- invites.target_role を roles.role_id と整合させる外部キー
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_invites_target_role_roles'
  ) THEN
    ALTER TABLE invites
      ADD CONSTRAINT fk_invites_target_role_roles
      FOREIGN KEY (target_role)
      REFERENCES roles(role_id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

-- user_role型が不要になったら削除（他カラム参照が残っている場合は削除されない）
DO $$
BEGIN
  BEGIN
    DROP TYPE IF EXISTS user_role;
  EXCEPTION WHEN dependent_objects_still_exist THEN
    -- 依存が残る場合はそのまま維持
    NULL;
  END;
END $$;

COMMIT;
