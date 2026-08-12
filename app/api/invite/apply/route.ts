import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { grantRoleToUser, resolveActiveRoleForIdentity } from '../../../../lib/auth/role-security'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, email } = body
    if (!token || !email) return NextResponse.json({ error: 'token and email required' }, { status: 400 })

    // find invite
    const { data: inv, error: invErr } = await supabaseAdmin.from('invites').select('*').eq('token', token).limit(1).single()
    if (invErr || !inv) return NextResponse.json({ error: 'invalid token' }, { status: 400 })

    const now = new Date().toISOString()
    const maxUses = inv.max_uses ?? 1
    const useCount = inv.use_count ?? 0
    const expired = inv.expires_at && inv.expires_at <= now
    const exhausted = (typeof maxUses === 'number' && maxUses > 0 && useCount >= maxUses)
    if (!(inv.status === 'active' && !expired && !exhausted)) return NextResponse.json({ error: 'invite not usable' }, { status: 400 })

    // find user by email
    const { data: userRows, error: userErr } = await supabaseAdmin.from('users').select('user_id').eq('email', email).limit(1).single()
    if (userErr || !userRows) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    // apply role (multi-role compatible)
    await grantRoleToUser({ userId: userRows.user_id, roleId: inv.target_role, makeCurrent: true })
    // increment invite use
    await supabaseAdmin.from('invites').update({ use_count: (useCount + 1) }).eq('invite_id', inv.invite_id)
    await supabaseAdmin.from('invite_usages').insert({ invite_id: inv.invite_id, used_by_user_id: userRows.user_id })

    // resolve and persist active role with fallback security
    await resolveActiveRoleForIdentity({ userId: userRows.user_id, email })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
