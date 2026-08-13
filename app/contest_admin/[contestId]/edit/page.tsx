import { redirect } from 'next/navigation'
import ContestEditorForm from '../../../../components/dashboard/contest/ContestEditorForm'
import { createSupabaseServerClient } from '../../../../lib/supabase/server-client'
import { resolveActiveRoleForIdentity } from '../../../../lib/auth/role-security'

export default async function EditContestPage({ params }: { params: Promise<{ contestId?: string }> | { contestId?: string } }) {
  const p = await params
  const contestId = Number(p?.contestId)

  if (!Number.isFinite(contestId)) {
    redirect('/contest_admin')
  }

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

  return <ContestEditorForm mode="edit" contestId={contestId} />
}
