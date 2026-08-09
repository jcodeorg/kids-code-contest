import React from 'react'
import DashboardShellClient from '../DashboardShellClient'

export default function RoleDashboard({ params }: { params: { role: string } }) {
  const role = params.role || 'applicant'
  const titleMap: Record<string, string> = {
    applicant: '応募者ダッシュボード',
    staff_primary: '一次採点スタッフダッシュボード',
    staff_manager: '集計管理スタッフダッシュボード',
    judge: '審査員ダッシュボード',
    admin: '管理者ダッシュボード',
  }
  const title = titleMap[role] || `${role} ダッシュボード`

  return <DashboardShellClient paramsRole={role} />
}
