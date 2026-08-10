import React from 'react'
import { redirect } from 'next/navigation'
import DashboardShellClient from '../dashboard/DashboardShellClient'
import { createSupabaseServerClient } from '../../lib/supabase/server-client'

export default async function RoleDashboard({ params }: { params: Promise<{ role?: string }> | { role?: string } }) {
  const p = await params
  const role = p?.role || 'applicant'

  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  if (!user?.email) {
    redirect('/auth/signin')
  }

  // read profile role from public users table
  const { data: profile, error: profileErr } = await supabase.from('users').select('role').eq('email', user.email).limit(1).single()
  if (profileErr || !profile) {
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

  if (profile.role !== role) {
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

  return <DashboardShellClient paramsRole={role} />
}
