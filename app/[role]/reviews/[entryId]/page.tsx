import { redirect } from 'next/navigation'
import StaffReviewEntry from '../../../../components/dashboard/contest/StaffReviewEntry'
import { createSupabaseServerClient } from '../../../../lib/supabase/server-client'
import { resolveActiveRoleForIdentity, switchActiveRoleByIdentity } from '../../../../lib/auth/role-security'

export default async function StaffReviewEntryPage({ params }: { params: Promise<{ role?: string; entryId?: string }> | { role?: string; entryId?: string } }) {
  const resolvedParams = await params
  const requestedRole = resolvedParams.role || 'staff'
  const entryId = resolvedParams.entryId || ''
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) redirect('/auth/signin')

  const resolved = await resolveActiveRoleForIdentity({ userId: data.user.id, email: data.user.email || undefined })
  if (!resolved.ok || !resolved.assignedRoleIds.includes(requestedRole)) redirect('/auth/signin')
  if (requestedRole !== resolved.currentRoleId) {
    await switchActiveRoleByIdentity({ userId: data.user.id, email: data.user.email || undefined, roleId: requestedRole })
  }

  return <StaffReviewEntry entryId={entryId} phase={requestedRole === 'judge' ? 'final' : 'primary'} />
}
