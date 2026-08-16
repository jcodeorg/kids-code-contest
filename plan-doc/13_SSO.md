アプリB（Supabase Auth）からアプリA（Express + Passport.js）へ、ワンタイムトークン方式を使って安全にSSO（シングルサインオン）を実装するための具体的な手順とコードを解説します。

---

### 全体アーキテクチャと処理の流れ

```
[ ブラウザ ]               [ アプリB (Supabase) ]            [ アプリA (Express + Passport) ]
    │                             │                                   │
    │ 1. 「アプリAへ」クリック    │                                   │
    ├────────────────────────────►│                                   │
    │                             │ 2. POST /api/sso/issue-token      │
    │                             │    (Google ID/Email + SHARED_KEY) │
    │                             ├──────────────────────────────────►│
    │                             │                                   │ 3. トークン生成＆メモリ保存
    │                             │ 4. { token: "xyz..." } 返却       │    (有効期限30秒)
    │                             │◄──────────────────────────────────┤
    │                             │                                   │
    │ 5. リダイレクト (app-a.com/api/sso/callback?token=xyz...)       │
    ├────────────────────────────────────────────────────────────────►│
    │                                                                 │ 6. トークン検証＆即破棄
    │                                                                 │ 7. Email/sub でユーザー紐付け/作成
    │                                                                 │ 8. req.login() でPassportセッション発行
    │ 9. アプリAのダッシュボード表示 (サインイン完了!)                 │
    │◄────────────────────────────────────────────────────────────────┤

```

---

### 手順 1：環境変数（共通シークレット鍵）の設定

アプリAとアプリBの双方の環境変数（`.env`）に、同一の長いランダム文字列を設定します。

```env
# アプリA と アプリB の両方の .env に配置
SHARED_SECRET_KEY=a_very_long_and_secure_random_secret_key_123456789

```

---

### 手順 2：アプリA側（Express + Passport.js）の実装

アプリAに「①トークン発行API」**と**「②SSOコールバックAPI（ログイン完了処理）」を追加します。

#### 1. トークン管理ユーティリティの追加

有効期限30秒のワンタイムトークンを保持するストアを作成します（小〜中規模であればメモリ管理で十分ですが、マルチサーバー環境の場合はRedisを推奨します）。

```javascript
// ssoStore.js (アプリA)
import crypto from 'crypto';

const tokenStore = new Map();

export function createSsoToken(userData) {
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore.set(token, {
    ...userData,
    expiresAt: Date.now() + 30 * 1000 // 30秒間有効
  });
  return token;
}

export function verifyAndConsumeSsoToken(token) {
  if (!token || !tokenStore.has(token)) return null;

  const data = tokenStore.get(token);
  tokenStore.delete(token); // 使い捨てのため即時削除

  if (Date.now() > data.expiresAt) return null; // 期限切れ

  return data;
}

```

#### 2. SSOエンドポイントの実装

既存のExpressアプリにSSO用のルーター（またはAPI）を追加します。

```javascript
// routes/sso.js (アプリA)
import express from 'express';
import { createSsoToken, verifyAndConsumeSsoToken } from './ssoStore.js';
import { db } from '../db.js'; // アプリAのデータベース操作用

const router = express.Router();

// -------------------------------------------------------------------
// ①【サーバー間通信】アプリBからの依頼を受け、ワンタイムトークンを発行
// -------------------------------------------------------------------
router.post('/api/sso/issue-token', (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (apiKey !== process.env.SHARED_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { googleSub, email, emailVerified } = req.body;

  if (!email || !emailVerified) {
    return res.status(400).json({ error: '確認済みのメールアドレスが必要です' });
  }

  const token = createSsoToken({ googleSub, email });
  return res.json({ token });
});

// -------------------------------------------------------------------
// ②【ブラウザ経由】トークンを検証し、Passport.js でログインセッションを発行
// -------------------------------------------------------------------
router.get('/api/sso/callback', async (req, res, next) => {
  const { token } = req.query;

  // 1. トークンの検証と一回限りの使用
  const payload = verifyAndConsumeSsoToken(token);
  if (!payload) {
    return res.status(400).send('SSOトークンが無効または有効期限切れです。');
  }

  try {
    // 2. アプリAのDBから Google ID (sub) または Email でユーザーを探す
    let user = await db.users.findOne({
      $or: [{ google_sub: payload.googleSub }, { email: payload.email }]
    });

    // 3. ユーザーが存在しない場合は新規作成（自動プロビジョニング）
    if (!user) {
      user = await db.users.create({
        email: payload.email,
        google_sub: payload.googleSub,
        createdAt: new Date()
      });
    } else if (!user.google_sub) {
      // 既存メールアドレスのアカウントに Google ID を紐付け更新
      await db.users.update(user.id, { google_sub: payload.googleSub });
    }

    // 4. Passport.js の標準ログイン機能でセッションCookieを発行
    req.login(user, (err) => {
      if (err) return next(err);
      
      // ログイン成功後、アプリAのダッシュボード等へ遷移
      return res.redirect('/dashboard');
    });

  } catch (error) {
    console.error('SSO Error:', error);
    return res.status(500).send('SSO処理中にエラーが発生しました。');
  }
});

export default router;

```

---

### 手順 3：アプリB側（Supabase側）の実装

アプリBでログインしているユーザーが「アプリAへ移動」ボタンを押した際の処理を作成します。

#### バックエンド処理（例: Next.js API Routes / Express / Node.js）

```javascript
// アプリB側のリダイレクトAPIエンドポイント
export async function handleSsoToAppA(req, res) {
  // 1. Supabase のセッションからログイン中ユーザーを取得
  const { user } = await supabase.auth.getUser(req.headers.authorization);

  if (!user || !user.email_confirmed_at) {
    return res.status(401).json({ error: '認証済みユーザーではありません' });
  }

  // Googleログインの場合、identities 内に sub が含まれます
  const googleIdentity = user.identities?.find(id => id.provider === 'google');
  const googleSub = googleIdentity ? googleIdentity.id : null;

  // 2. アプリAのトークン発行APIをサーバー間通信で呼ぶ
  const response = await fetch('https://app-a.com/api/sso/issue-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.SHARED_SECRET_KEY
    },
    body: JSON.stringify({
      googleSub: googleSub,
      email: user.email,
      emailVerified: !!user.email_confirmed_at
    })
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    return res.status(500).json({ error: 'SSOトークンの取得に失敗しました' });
  }

  // 3. アプリAのSSOコールバックURLへリダイレクト
  return res.redirect(`https://app-a.com/api/sso/callback?token=${data.token}`);
}

```

---

### テストと検証手順

1. **基本動線の確認**: アプリBでログインした状態でボタンを押すと、アプリAの `/dashboard` にサインイン状態で遷移すること。
2. **ワンタイム性の検証**: 一度リダイレクトされた後のURL（`[https://app-a.com/api/sso/callback?token=](https://app-a.com/api/sso/callback?token=)...`）をブラウザで再読み込みし、エラーメッセージが表示されて再ログインできないことを確認。
3. **アカウント紐付けの確認**: アプリAに既存の同名メールアドレスアカウントがある場合、サインイン後にその既存アカウントのデータが表示されることを確認。