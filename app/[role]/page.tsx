import React from 'react'
import { redirect } from 'next/navigation'
import DashboardShellClient from '../../components/dashboard/DashboardShellClient'
import { createSupabaseServerClient } from '../../lib/supabase/server-client'
import { resolveActiveRoleForIdentity, switchActiveRoleByIdentity } from '../../lib/auth/role-security'

export default async function RoleDashboard({ params }: { params: Promise<{ role?: string }> | { role?: string } }) {
  const p = await params
  const requestedRole = p?.role || 'applicant'

  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  if (!user?.email) {
    redirect('/auth/signin')
  }

  const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email || undefined })

  if (!resolved.ok) {
    if (resolved.code === 'NO_ASSIGNED_ROLES') {
      return (
        <div className="w-full px-4 py-10">
          <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl">アクセス不可</h2>
              <p className="text-base-content/70">利用可能な権限がありません。管理者にお問い合わせください。</p>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="w-full px-4 py-10">
        <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl">プロフィールが見つかりません</h2>
            <p className="text-base-content/70">管理者にお問い合わせください。</p>
          </div>
        </div>
      </div>
    )
  }

  if (!resolved.assignedRoleIds.includes(requestedRole)) {
    return (
      <div className="w-full px-4 py-10">
        <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl">アクセス不可</h2>
            <p className="text-base-content/70">このページを表示する権限がありません。</p>
          </div>
        </div>
      </div>
    )
  }

  let activeRole = resolved.currentRoleId
  if (requestedRole !== resolved.currentRoleId) {
    const switched = await switchActiveRoleByIdentity({ userId: user.id, email: user.email || undefined, roleId: requestedRole })
    if (switched.ok) activeRole = switched.currentRoleId
  }

  return <DashboardShellClient paramsRole={activeRole} />
}
