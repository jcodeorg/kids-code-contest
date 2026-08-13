---

# Next.js Webアプリ Navbar 設計仕様書

本ドキュメントは、コンテスト審査・管理システムにおける Next.js（App Router）Webアプリケーションのナビゲーションバー（Navbar）設計方針および仕様をまとめたものです。

---

## 1. 全体レイアウト構成

画面最上部に常時表示されるナビゲーションバーは、3つの領域に分割した構造とします。

| 領域 | 表示要素 | 概要・役割 |
| --- | --- | --- |
| **左端** | アプリケーションタイトル / ロゴ | サイトTopへのリンク。現在のサービスを識別させるコンテキストを提供。 |
| **中央** | ロール別可変メニュー | サインインしているユーザーのロール（権限）に応じて動的に変化する操作ナビゲーション。 |
| **右端** | サインイン状態 / アバター | 未認証時は「サインイン」ボタン、認証時は「ユーザーアバター / ドロップダウンメニュー」を表示。 |

---

## 2. ロール別メニュー仕様

ユーザーのロールに応じた中央メニューの表示設計および画面遷移先の一覧です。

URL パスは `/[role]/[feature]` の統一形式とし、短縮記法（`aggregate_1`, `aggregate_2`）を採用しています。

| ロール (`Role`) | 表示メニュー（優先度順） | URL パス | 説明・UX方針 |
| --- | --- | --- | --- |
| **`applicant`**<br>

<br>(応募者) | *（なし / ダッシュボードのみ）* | `/applicant/dashboard` | 応募作業や提出確認に専念させるため、中央メニューは非表示。 |
| **`staff`**<br>

<br>(一次審査員/スタッフ) | 1. 私の審査<br>

<br>2. 応募作品一覧<br>

<br>3. 一次集計 | `/staff/reviews`<br>

<br>`/staff/submissions`<br>

<br>`/staff/aggregate` | メイン作業である「私の審査」を最左に配置し、確認・俯瞰用メニューを順に配置。 |
| **`judge`**<br>

<br>(二次審査員) | 1. 私の審査<br>

<br>2. 上位作品一覧<br>

<br>3. 二次集計 | `/judge/reviews`<br>

<br>`/judge/top_submissions`<br>

<br>`/judge/aggregate` | 二次審査対象の閲覧および審査入力、進行状況の集計確認。 |
| **`contest_admin`**<br>

<br>(コンテスト管理者) | 1. 一次集計<br>

<br>2. 二次集計<br>

<br>3. コンテスト管理 | `/contest_admin/aggregate_1`<br>

<br>`/contest_admin/aggregate_2`<br>

<br>`/contest_admin/settings` | 審査進捗の集計確認およびコンテスト設定・期間管理など運営全般の管理。 |
| **`admin`**<br>

<br>(全体管理者) | 1. システム管理<br>

<br>2. ユーザー管理 | `/admin/system`<br>

<br>`/admin/users` | システム設定やユーザー権限付与などの保守管理作業用。 |

---

## 3. 技術仕様・プラクティス (Next.js App Router)

### 3.1 定数設定ファイル (`config/navigation.ts`)

ロールごとのメニュー項目はコンポーネント内にハードコーディングせず、定数ファイルとして集約・管理します。

```typescript
// config/navigation.ts

export type Role = 'applicant' | 'staff' | 'judge' | 'contest_admin' | 'admin';

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  // 応募者はナビメニューなし（ダッシュボード等に集中させる）
  applicant: [],

  staff: [
    { label: '私の審査', href: '/staff/reviews' },
    { label: '応募作品一覧', href: '/staff/submissions' },
    { label: '一次集計', href: '/staff/aggregate' },
  ],

  judge: [
    { label: '私の審査', href: '/judge/reviews' },
    { label: '上位作品一覧', href: '/judge/top_submissions' },
    { label: '二次集計', href: '/judge/aggregate' },
  ],

  contest_admin: [
    { label: '一次集計', href: '/contest_admin/aggregate_1' },
    { label: '二次集計', href: '/contest_admin/aggregate_2' },
    { label: 'コンテスト管理', href: '/contest_admin/settings' },
  ],

  admin: [
    { label: 'システム管理', href: '/admin/system' },
    { label: 'ユーザー管理', href: '/admin/users' },
  ],
};

```

### 3.2 Server Component による表示最適化 (CLS対策)

Navbar 全体を React Server Component (RSC) として実装し、サーバー側でセッションとロールを判定してレンダリングすることで、読み込み直後のチラつき（CLS: Cumulative Layout Shift）を防止します。

```tsx
// components/Navbar.tsx
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { NAV_ITEMS, Role } from '@/config/navigation';
import { UserMenu } from './UserMenu'; // アバターやドロップダウンを扱うClient Component

export async function Navbar() {
  const session = await getSession();
  const role: Role = session?.user?.role ?? 'applicant';
  const navItems = NAV_ITEMS[role] || [];

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
      {/* 左端: タイトル */}
      <div className="font-bold text-xl text-gray-900">
        <Link href="/">Contest Platform</Link>
      </div>

      {/* 中央: ロール別可変メニュー（PC表示） */}
      <nav className="hidden md:flex gap-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* 右端: サインイン状況 */}
      <div className="flex items-center gap-4">
        <UserMenu session={session} />
      </div>
    </header>
  );
}

```

---

## 4. レスポンシブ & UX 配慮事項

1. **モバイル表示（ハンバーガーメニュー）**
* モバイル画面（`md` 未満）では、中央の可変メニューをハンバーガーアイコン内に折りたたみ、右端にはユーザーアイコンのみを表示する構成とします。


2. **ディレクトリ構造との整合性**
* Next.js の App Router において `app/[role]/` という動的セグメントでルートグループを作成することで、ロールごとの Middleware や Layout 処理がスマートに組めるよう設計します。
