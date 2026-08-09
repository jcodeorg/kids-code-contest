import React from 'react'
import AdminPanel from '../admin/AdminPanel'
import SignOutClient from '../SignOutClient'

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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>{title}</h1>
      <SignOutClient role={role} />
      {role === 'admin' ? (
        <AdminPanel />
      ) : (
        <>
          <p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p>
          <p>必要なウィジェットやリンクをここに追加してください。</p>
        </>
      )}
    </div>
  )
}
