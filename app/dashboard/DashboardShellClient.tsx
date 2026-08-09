'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import SignOutClient from './SignOutClient'
import AdminPanel from './admin/AdminPanel'
import ApplicantGuardianPanel from './ApplicantGuardianPanel'

export default function DashboardShellClient({ paramsRole }: { paramsRole?: string }) {
  const pathname = usePathname() || ''
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  const role = last || paramsRole || 'applicant'

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
        <>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>admin</div>
          <AdminPanel />
        </>
      ) : (
        <>
          {role === 'applicant' ? (
            <>
              <ApplicantGuardianPanel />
              <p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p>
              <p>必要なウィジェットやリンクをここに追加してください。</p>
            </>
          ) : (
            <>
              <p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p>
              <p>必要なウィジェットやリンクをここに追加してください。</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
