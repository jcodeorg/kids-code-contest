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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h2>プロフィールが見つかりません</h2>
        <p>管理者にお問い合わせください。</p>
      </div>
    )
  }

  if (profile.role !== role) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h2>アクセス不可</h2>
        <p>このページを表示する権限がありません。</p>
      </div>
    )
  }

  return <DashboardShellClient paramsRole={role} />
}
