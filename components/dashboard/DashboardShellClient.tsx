'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import AdminPanel from './admin/AdminPanel'
import ApplicantGuardianPanel from './ApplicantGuardianPanel'
import ApplicantContestPanel from './contest/ApplicantContestPanel'
import ReviewPanel from './contest/ReviewPanel'
import ContestAdminJudgingPanel from './contest/ContestAdminJudgingPanel'

export default function DashboardShellClient({ paramsRole }: { paramsRole?: string }) {
  const pathname = usePathname() || ''
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  const role = last || paramsRole || 'applicant'

  const titleMap: Record<string, string> = {
    applicant: '応募者ダッシュボード',
    staff: '一次採点スタッフダッシュボード',
    contest_admin: 'コンテスト管理者ダッシュボード',
    staff_primary: '一次採点スタッフダッシュボード',
    staff_manager: '集計管理スタッフダッシュボード',
    judge: '審査員ダッシュボード',
    admin: '管理者ダッシュボード',
  }
  const title = titleMap[role] || `${role} ダッシュボード`

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      {role === 'admin' ? (
        <>
          <div className="badge badge-primary badge-outline mb-3">admin</div>
          <AdminPanel />
          <ContestAdminJudgingPanel />
        </>
      ) : (
        <>
          {role === 'applicant' ? (
            <>
              <ApplicantGuardianPanel />
              <ApplicantContestPanel />
              <div className="card bg-base-100 shadow-md border border-base-200">
                <div className="card-body">
                  <p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p>
                  <p className="text-base-content/70">必要なウィジェットやリンクをここに追加してください。</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {(role === 'staff' || role === 'staff_primary' || role === 'staff_manager') ? (
                <ReviewPanel phase="primary" roleLabel="一次審査（primary）" />
              ) : null}
              {role === 'judge' ? (
                <ReviewPanel phase="final" roleLabel="二次審査（final）" />
              ) : null}
              {role === 'contest_admin' ? (
                <>
                  <ReviewPanel phase="primary" roleLabel="一次審査の確認" />
                  <ReviewPanel phase="final" roleLabel="二次審査の確認" />
                  <ContestAdminJudgingPanel />
                </>
              ) : null}
              {(role !== 'staff' && role !== 'staff_primary' && role !== 'staff_manager' && role !== 'judge' && role !== 'contest_admin') ? (
                <div className="card bg-base-100 shadow-md border border-base-200">
                  <div className="card-body">
                    <p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p>
                    <p className="text-base-content/70">必要なウィジェットやリンクをここに追加してください。</p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}
