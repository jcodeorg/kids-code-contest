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
    { label: '私の審査', href: '/staff/reviews' },
    { label: '応募作品一覧', href: '/staff/submissions' },
    { label: '一次集計', href: '/staff/aggregate' },
  ],
  staff_primary: [
    { label: '私の審査', href: '/staff/reviews' },
    { label: '応募作品一覧', href: '/staff/submissions' },
    { label: '一次集計', href: '/staff/aggregate' },
  ],
  staff_manager: [
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
    { label: 'コンテスト管理', href: '/contest_admin' },
    { label: '一次集計', href: '/contest_admin/aggregate_1' },
    { label: '二次集計', href: '/contest_admin/aggregate_2' },
  ],
  admin: [
    { label: 'システム管理', href: '/admin/system' },
    { label: 'ユーザー管理', href: '/admin/users' },
  ],
}
