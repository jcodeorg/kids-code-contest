import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { resolveActiveRoleForIdentity } from '../../../../lib/auth/role-security'

function bearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

export async function GET(req: Request) {
  try {
    const accessToken = bearerTokenFromRequest(req)
    if (!accessToken) return NextResponse.json({ error: 'authorization token required' }, { status: 401 })

    const authRes = await supabaseAdmin.auth.getUser(accessToken)
    if (authRes.error || !authRes.data.user?.id) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 })
    }

    const user = authRes.data.user
    const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email || undefined })

    if (!resolved.ok) {
      if (resolved.code === 'NO_ASSIGNED_ROLES') {
        return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: 403 })
      }
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: 404 })
    }

    return NextResponse.json({
      user_id: resolved.userId,
      current_role_id: resolved.currentRoleId,
      assigned_role_ids: resolved.assignedRoleIds,
      mode: resolved.mode,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
