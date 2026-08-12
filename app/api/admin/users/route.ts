import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { replaceUserRoles, resolveActiveRoleForIdentity, VALID_ROLES } from '../../../../lib/auth/role-security'

const LEGACY_ROLE_VALUES = new Set(['applicant', 'staff_primary', 'staff_manager', 'judge', 'admin'])
const LEGACY_ROLE_ALIAS: Record<string, string> = {
  staff: 'staff_primary',
  contest_admin: 'staff_manager',
}

function errorToMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  const maybeMsg = (err as { message?: unknown } | null | undefined)?.message
  if (typeof maybeMsg === 'string') return maybeMsg
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function isRelationMissingError(error: any) {
  const msg = String(error?.message || '')
  return msg.includes('relation') && msg.includes('does not exist')
}

function isColumnMissingError(error: any, columnName: string) {
  const msg = String(error?.message || '')
  return msg.includes('column') && msg.includes(columnName) && msg.includes('does not exist')
}

async function getAssignedRoleMap(userIds: string[]) {
  if (!userIds.length) return { map: {} as Record<string, string[]>, mode: 'none' as const }

  const roleRes = await supabaseAdmin
    .from('user_roles')
    .select('user_id,role_id')
    .in('user_id', userIds)

  if (roleRes.error) {
    if (isRelationMissingError(roleRes.error)) {
      return { map: {} as Record<string, string[]>, mode: 'legacy' as const }
    }
    throw roleRes.error
  }

  const map: Record<string, string[]> = {}
  for (const row of roleRes.data || []) {
    const key = row.user_id as string
    if (!map[key]) map[key] = []
    map[key].push(row.role_id as string)
  }
  return { map, mode: 'multi-role' as const }
}

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

  return { ok: true as const }
}

export async function GET(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const url = new URL(req.url)
    const q = url.searchParams.get('q') || undefined
    const role = url.searchParams.get('role') || undefined
    const guardian = url.searchParams.get('guardian') || undefined
    const user_id = url.searchParams.get('user_id') || undefined

    const selectCols = 'user_id,email,name,name_kana,role,current_role_id,guardian_consent,is_active,created_at'

    // if user_id is provided, return single user
    if (user_id) {
      let rowRes = await supabaseAdmin.from('users').select(selectCols).eq('user_id', user_id).single()
      if (rowRes.error && isColumnMissingError(rowRes.error, 'current_role_id')) {
        rowRes = await supabaseAdmin.from('users').select('user_id,email,name,name_kana,role,guardian_consent,is_active,created_at').eq('user_id', user_id).single()
      }
      const { data, error } = rowRes
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const assigned = await getAssignedRoleMap([data.user_id])
      const assignedRoles = assigned.mode === 'multi-role'
        ? (assigned.map[data.user_id] || [])
        : [data.current_role_id || data.role || 'applicant']

      return NextResponse.json({
        user: {
          ...data,
          current_role_id: data.current_role_id || data.role || 'applicant',
          assigned_role_ids: assignedRoles,
        },
      })
    }

    let query = supabaseAdmin.from('users').select(selectCols).order('created_at', { ascending: false })
    if (q) {
      // basic ilike on email OR name
      query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`)
    }
    if (role) query = query.or(`role.eq.${role},current_role_id.eq.${role}`)
    if (guardian) query = query.eq('guardian_consent', guardian)

    let { data, error } = await query
    if (error && isColumnMissingError(error, 'current_role_id')) {
      let fallbackQuery = supabaseAdmin.from('users').select('user_id,email,name,name_kana,role,guardian_consent,is_active,created_at').order('created_at', { ascending: false })
      if (q) fallbackQuery = fallbackQuery.or(`email.ilike.%${q}%,name.ilike.%${q}%`)
      if (role) fallbackQuery = fallbackQuery.eq('role', role)
      if (guardian) fallbackQuery = fallbackQuery.eq('guardian_consent', guardian)
      const fallbackRes = await fallbackQuery
      data = fallbackRes.data
      error = fallbackRes.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userIds = (data || []).map((u: any) => u.user_id)
    const assigned = await getAssignedRoleMap(userIds)

    const users = (data || []).map((u: any) => {
      const assignedRoles = assigned.mode === 'multi-role'
        ? (assigned.map[u.user_id] || [u.current_role_id || u.role || 'applicant'])
        : [u.current_role_id || u.role || 'applicant']
      return {
        ...u,
        current_role_id: u.current_role_id || u.role || 'applicant',
        assigned_role_ids: assignedRoles,
      }
    })

    return NextResponse.json({ users })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const body = await req.json()
    const { user_id, role, is_active, name, name_kana, assigned_roles, current_role_id } = body
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    const updates: any = {}
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (typeof name === 'string' && name.trim().length > 0) {
      if (name.length > 200) return NextResponse.json({ error: 'name too long' }, { status: 400 })
      updates.name = name.trim()
    }
    if (typeof name_kana === 'string') {
      const v = name_kana.trim()
      if (v.length > 200) return NextResponse.json({ error: 'name_kana too long' }, { status: 400 })
      updates.name_kana = v
    }

    // Backward compatibility: role単体更新を assigned_roles に変換
    let assignedRoles: string[] | null = null
    if (Array.isArray(assigned_roles)) {
      assignedRoles = assigned_roles
    } else if (typeof role === 'string' && role) {
      assignedRoles = [role]
    }

    if (assignedRoles) {
      const invalid = assignedRoles.find((r) => !VALID_ROLES.includes(r as any))
      if (invalid) return NextResponse.json({ error: `invalid role: ${invalid}` }, { status: 400 })

      const replaced = await replaceUserRoles({
        userId: user_id,
        roleIds: assignedRoles,
        currentRoleId: typeof current_role_id === 'string' ? current_role_id : undefined,
      })

      if (!replaced.ok) {
        return NextResponse.json({ error: replaced.message, code: replaced.code }, { status: 400 })
      }
      updates.current_role_id = replaced.currentRoleId

      const legacyRole = LEGACY_ROLE_VALUES.has(replaced.currentRoleId) ? replaced.currentRoleId : LEGACY_ROLE_ALIAS[replaced.currentRoleId]
      if (legacyRole) updates.role = legacyRole
    } else if (typeof current_role_id === 'string' && current_role_id) {
      if (!VALID_ROLES.includes(current_role_id as any)) {
        return NextResponse.json({ error: 'invalid current_role_id' }, { status: 400 })
      }
      updates.current_role_id = current_role_id

      const legacyRole = LEGACY_ROLE_VALUES.has(current_role_id) ? current_role_id : LEGACY_ROLE_ALIAS[current_role_id]
      if (legacyRole) updates.role = legacyRole
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates provided' }, { status: 400 })

    let updateRes = await supabaseAdmin.from('users').update(updates).eq('user_id', user_id).select().single()
    if (updateRes.error && isColumnMissingError(updateRes.error, 'current_role_id')) {
      const fallbackUpdates = { ...updates }
      delete fallbackUpdates.current_role_id
      updateRes = await supabaseAdmin.from('users').update(fallbackUpdates).eq('user_id', user_id).select().single()
    }

    const { data, error } = updateRes
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ user: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req)
    if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

    const body = await req.json()
    const { user_id } = body
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    // delete from users table
    const { data, error } = await supabaseAdmin.from('users').delete().eq('user_id', user_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, user: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
