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

  // Prefer auth UID based lookup for safer RLS compatibility.
  let profile: { role?: string } | null = null
  let profileErr: any = null

  const byUserId = await supabase.from('users').select('role').eq('user_id', user.id).limit(1).maybeSingle()
  profile = byUserId.data
  profileErr = byUserId.error

  // Backward compatibility for legacy rows not yet aligned to auth uid.
  if (!profile && user.email) {
    const byEmail = await supabase.from('users').select('role').eq('email', user.email).limit(1).maybeSingle()
    profile = byEmail.data
    profileErr = byEmail.error
  }

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
