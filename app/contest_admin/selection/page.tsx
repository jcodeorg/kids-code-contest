import { redirect } from 'next/navigation'
import PrimarySelectionPanel from '../../../components/dashboard/contest/PrimarySelectionPanel'
import { createSupabaseServerClient } from '../../../lib/supabase/server-client'
import { resolveActiveRoleForIdentity } from '../../../lib/auth/role-security'

export default async function ContestAdminSelectionPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user?.email) redirect('/auth/signin')

  const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email || undefined })
  if (!resolved.ok || !resolved.assignedRoleIds.some((role) => role === 'contest_admin' || role === 'admin')) {
    redirect('/auth/signin')
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <PrimarySelectionPanel />
      </div>
    </div>
  )
}
