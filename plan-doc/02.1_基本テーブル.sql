-- 1. ユーザーロール定義 (ENUM)
CREATE TYPE user_role AS ENUM (
    'applicant',      -- 応募者
    'staff_primary',  -- 一次採点スタッフ
    'staff_manager',  -- 集計管理スタッフ
    'judge',          -- 審査員
    'admin'           -- システム管理者
);

-- 2. 保護者同意ステータス定義 (ENUM)
CREATE TYPE guardian_consent_status AS ENUM (
    'pending',   -- 保護者同意待ち（作品応募・修正は可能だが審査対象外）
    'approved',  -- 保護者同意完了（正式に審査対象）
    'rejected'   -- 保護者により拒否
);

-- 3. 招待ステータス定義 (ENUM)
CREATE TYPE invite_status AS ENUM ('active', 'exhausted', 'expired', 'cancelled');

-- 4. ユーザーテーブル (users)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,          -- アカウント統合のキーとなる一意アドレス
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'email', -- 'google', 'email', 'multiple'
    name VARCHAR(100) NOT NULL,
    name_kana VARCHAR(100),
    school_name VARCHAR(100),
    grade VARCHAR(20),
    guardian_name VARCHAR(100),
    guardian_email VARCHAR(255),
    guardian_phone VARCHAR(50),
    guardian_consent guardian_consent_status NOT NULL DEFAULT 'pending', -- 保護者同意ステータス
    guardian_consent_at TIMESTAMP WITH TIME ZONE,                        -- 同意完了日時
    guardian_consent_token VARCHAR(255) UNIQUE,                          -- 保護者承認用トークン
    role user_role NOT NULL DEFAULT 'applicant',                         -- 単一ロール管理
    is_active BOOLEAN NOT NULL DEFAULT true,                             -- アカウント有効化フラグ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 招待管理テーブル (invites)
CREATE TABLE invites (
    invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,           -- ワンタイム/マルチユース トークン
    target_role user_role NOT NULL,             -- 付与する権限 ('staff_primary', 'staff_manager', 'judge')
    max_uses INT NOT NULL DEFAULT 1,            -- 利用上限回数 (1: 単発, N: 複数回利用可能)
    use_count INT NOT NULL DEFAULT 0,           -- 現在の利用達成回数
    status invite_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 有効期限
    created_by_user_id UUID NOT NULL REFERENCES users(user_id), -- 発行した管理者ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 招待利用履歴テーブル (invite_usages)
CREATE TABLE invite_usages (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID NOT NULL REFERENCES invites(invite_id) ON DELETE CASCADE,
    used_by_user_id UUID NOT NULL REFERENCES users(user_id), -- 登録・権限昇格したユーザーID
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 検索・パフォーマンス向上のためのインデックス設定
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_guardian_consent ON users(guardian_consent);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invite_usages_invite ON invite_usages(invite_id);
