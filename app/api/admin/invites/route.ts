import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { resolveActiveRoleForIdentity, VALID_ROLES } from '../../../../lib/auth/role-security'

const INVITABLE_ROLES = ['staff', 'contest_admin', 'staff_primary', 'staff_manager', 'judge', 'admin']

async function ensureAdmin(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!token) return { ok: false as const, status: 401, error: 'authorization token required' }

  const authRes = await supabaseAdmin.auth.getUser(token)
  if (authRes.error || !authRes.data.user?.id) {
    return { ok: false as const, status: 401, error: 'invalid token' }
  }

  const user = authRes.data.user
  const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email || undefined })
  if (!resolved.ok) {
    const status = resolved.code === 'NO_ASSIGNED_ROLES' ? 403 : 404
    return { ok: false as const, status, error: resolved.message }
  }

  if (resolved.currentRoleId !== 'admin') {
    return { ok: false as const, status: 403, error: 'admin role required' }
  }

  return { ok: true as const, userId: resolved.userId }
}

export async function GET(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const { data, error } = await supabaseAdmin.from('invites').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invites: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const body = await req.json()
    const { target_role, max_uses, expires_in_hours } = body
    if (!target_role) return NextResponse.json({ error: 'target_role required' }, { status: 400 })
    if (!VALID_ROLES.includes(target_role as any) || !INVITABLE_ROLES.includes(target_role)) {
      return NextResponse.json({ error: 'invalid target_role' }, { status: 400 })
    }

    // derive creator from Authorization bearer token (server-side determination)
    const authHeader = (req.headers.get('authorization') || '')
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
    if (!accessToken) return NextResponse.json({ error: 'authorization token required' }, { status: 401 })

    // decode JWT payload (no signature verification here) to extract sub (user id)
    let created_by_user_id: string | null = null
    try {
      const parts = accessToken.split('.')
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
        created_by_user_id = payload?.sub || payload?.user_id || null
      }
    } catch (e) {
      console.warn('[invites] failed to decode token payload', e)
    }

    if (!created_by_user_id) return NextResponse.json({ error: 'could not determine creator from token' }, { status: 401 })

    // resolvedCreatorId: the user_id we will store on the invite (may differ from provided id if email exists)
    let resolvedCreatorId = created_by_user_id

    // ensure the creator exists in our `users` table; if not, try to create a minimal profile
    const { data: existingCreator, error: creatorErr } = await supabaseAdmin.from('users').select('*').eq('user_id', created_by_user_id).limit(1)
    if (creatorErr) return NextResponse.json({ error: creatorErr.message }, { status: 500 })
    if (!Array.isArray(existingCreator) || existingCreator.length === 0) {
      // try to look up the auth user via admin API
      try {
        const { data: adminList, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
        if (listErr) {
          console.warn('[invites] failed to list auth users:', listErr.message)
          return NextResponse.json({ error: 'creator not found in users table and auth lookup failed' }, { status: 400 })
        }
        const authUser = adminList?.users?.find((u: any) => u.id === created_by_user_id || u.user_id === created_by_user_id)
        if (!authUser) {
          return NextResponse.json({ error: 'creator not found' }, { status: 400 })
        }

        const creatorEmail = authUser.email || null
        const creatorName = authUser.user_metadata?.name || authUser.user_metadata?.full_name || '管理者'

        // Attempt to insert a minimal profile with the auth user_id. If the email already exists, fall back
        // to use the existing row's user_id so we don't violate unique email constraint.
        const { data: createdCreator, error: createProfileErr } = await supabaseAdmin
          .from('users')
          .insert({ user_id: created_by_user_id, email: creatorEmail, name: creatorName, current_role_id: 'admin', is_active: true })
          .select()
          .single()

        if (createProfileErr) {
          const isDuplicateEmail = /duplicate|already exists|violat/i.test(createProfileErr.message)
          if (isDuplicateEmail && creatorEmail) {
            // find existing by email and use its user_id
            const { data: existingByEmail, error: findErr } = await supabaseAdmin.from('users').select('*').eq('email', creatorEmail).limit(1)
            if (findErr) {
              console.warn('[invites] failed to lookup existing user by email after duplicate error:', findErr.message)
              return NextResponse.json({ error: createProfileErr.message }, { status: 500 })
            }
            if (Array.isArray(existingByEmail) && existingByEmail.length > 0) {
              resolvedCreatorId = existingByEmail[0].user_id
            } else {
              console.warn('[invites] duplicate email but could not find existing row')
              return NextResponse.json({ error: createProfileErr.message }, { status: 500 })
            }
          } else {
            console.warn('[invites] failed to create creator profile:', createProfileErr.message)
            return NextResponse.json({ error: createProfileErr.message }, { status: 500 })
          }
        } else {
          resolvedCreatorId = createdCreator.user_id
        }
      } catch (e: any) {
        console.warn('[invites] exception while ensuring creator:', String(e))
        return NextResponse.json({ error: 'failed to ensure creator exists' }, { status: 500 })
      }
    }

    const token = crypto.randomUUID()
    const now = new Date()
    const hours = Number(expires_in_hours || 24)
    const expires_at = new Date(now.getTime() + hours * 3600 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('invites')
      .insert({ token, target_role, max_uses: max_uses ?? 1, use_count: 0, status: 'active', expires_at, created_by_user_id: resolvedCreatorId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const body = await req.json()
    const { invite_id, status } = body
    if (!invite_id || !status) return NextResponse.json({ error: 'invite_id and status required' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from('invites').update({ status }).eq('invite_id', invite_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
