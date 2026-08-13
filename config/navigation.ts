export type Role =
  | 'applicant'
  | 'staff'
  | 'staff_primary'
  | 'staff_manager'
  | 'judge'
  | 'contest_admin'
  | 'admin'

export type NavItem = {
  label: string
  href: string
}

export const ROLE_LABELS: Record<string, string> = {
  applicant: '応募者',
  staff: 'スタッフ',
  staff_primary: '一次採点',
  staff_manager: '集計管理',
  judge: '審査員',
  contest_admin: 'コンテスト管理',
  admin: '管理者',
}

export const NAV_ITEMS: Record<string, NavItem[]> = {
  applicant: [
    { label: 'ダッシュボード', href: '/applicant' },
  ],
  staff: [
    { label: '私の審査', href: '/staff' },
    { label: '応募作品一覧', href: '/staff' },
    { label: '一次集計', href: '/staff' },
  ],
  staff_primary: [
    { label: '私の審査', href: '/staff' },
    { label: '応募作品一覧', href: '/staff' },
    { label: '一次集計', href: '/staff' },
  ],
  staff_manager: [
    { label: '私の審査', href: '/staff' },
    { label: '応募作品一覧', href: '/staff' },
    { label: '一次集計', href: '/staff' },
  ],
  judge: [
    { label: '私の審査', href: '/judge' },
    { label: '上位作品一覧', href: '/judge' },
    { label: '二次集計', href: '/judge' },
  ],
  contest_admin: [
    { label: '一次集計', href: '/contest_admin' },
    { label: '二次集計', href: '/contest_admin' },
    { label: 'コンテスト管理', href: '/contest_admin' },
  ],
  admin: [
    { label: 'システム管理', href: '/admin' },
    { label: 'ユーザー管理', href: '/admin/user' },
  ],
}
