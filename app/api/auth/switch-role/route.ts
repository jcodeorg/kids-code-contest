import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { switchActiveRoleByIdentity } from '../../../../lib/auth/role-security'

function bearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

export async function POST(req: Request) {
  try {
    const accessToken = bearerTokenFromRequest(req)
    if (!accessToken) return NextResponse.json({ error: 'authorization token required' }, { status: 401 })

    const authRes = await supabaseAdmin.auth.getUser(accessToken)
    if (authRes.error || !authRes.data.user?.id) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const roleId = typeof body?.role_id === 'string' ? body.role_id : ''
    if (!roleId) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

    const user = authRes.data.user
    const switched = await switchActiveRoleByIdentity({ userId: user.id, email: user.email || undefined, roleId })

    if (!switched.ok) {
      const status = switched.code === 'ROLE_NOT_ASSIGNED' || switched.code === 'NO_ASSIGNED_ROLES' ? 403 : 400
      return NextResponse.json({ error: switched.message, code: switched.code }, { status })
    }

    return NextResponse.json({
      ok: true,
      current_role_id: switched.currentRoleId,
      assigned_role_ids: switched.assignedRoleIds,
      redirect_to: `/${switched.currentRoleId}`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
