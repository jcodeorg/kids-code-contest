import { redirect } from 'next/navigation'
import ContestAdminJudgingPanel from '../../../components/dashboard/contest/ContestAdminJudgingPanel'
import { createSupabaseServerClient } from '../../../lib/supabase/server-client'
import { resolveActiveRoleForIdentity } from '../../../lib/auth/role-security'

export default async function ContestAdminEntriesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  if (!user?.email) {
    redirect('/auth/signin')
  }

  const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email || undefined })
  if (!resolved.ok || !resolved.assignedRoleIds.includes('contest_admin')) {
    redirect('/auth/signin')
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <ContestAdminJudgingPanel mode="entries" />
      </div>
    </div>
  )
}
