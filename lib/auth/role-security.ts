import { supabaseAdmin } from '../supabase/server'

export const VALID_ROLES = [
  'applicant',
  'staff',
  'contest_admin',
  'staff_primary',
  'staff_manager',
  'judge',
  'admin',
] as const

export type RoleId = (typeof VALID_ROLES)[number]

const ROLE_PRIORITY: RoleId[] = [
  'applicant',
  'staff',
  'staff_primary',
  'staff_manager',
  'contest_admin',
  'judge',
  'admin',
]

function isRelationMissingError(error: unknown) {
  const msg = String((error as { message?: string } | null | undefined)?.message || '')
  return msg.includes('relation') && msg.includes('does not exist')
}

function isColumnMissingError(error: unknown, columnName: string) {
  const msg = String((error as { message?: string } | null | undefined)?.message || '')
  return msg.includes(`column`) && msg.includes(columnName) && msg.includes('does not exist')
}

function uniqueRoles(roles: string[]) {
  return Array.from(new Set(roles.filter((r) => VALID_ROLES.includes(r as RoleId))))
}

function pickFallbackRole(assignedRoles: string[]) {
  if (assignedRoles.includes('applicant')) return 'applicant'
  for (const role of ROLE_PRIORITY) {
    if (assignedRoles.includes(role)) return role
  }
  return assignedRoles[0]
}

async function loadUserByIdentity(userId?: string, email?: string) {
  let profile: {
    user_id: string
    email?: string | null
    current_role_id?: string | null
    is_active?: boolean | null
  } | null = null

  if (userId) {
    const byUserId = await supabaseAdmin
      .from('users')
      .select('user_id,email,current_role_id,is_active')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (!byUserId.error && byUserId.data) {
      profile = byUserId.data
    } else if (isColumnMissingError(byUserId.error, 'current_role_id')) {
      throw new Error('users.current_role_id column is missing. Apply multi-role SQL migration first.')
    }
  }

  if (!profile && email) {
    const byEmail = await supabaseAdmin
      .from('users')
      .select('user_id,email,current_role_id,is_active')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (!byEmail.error && byEmail.data) {
      profile = byEmail.data
    } else if (isColumnMissingError(byEmail.error, 'current_role_id')) {
      throw new Error('users.current_role_id column is missing. Apply multi-role SQL migration first.')
    }
  }

  return { profile }
}

async function updateActiveRole(userId: string, roleId: string) {
  const withCurrent = await supabaseAdmin
    .from('users')
    .update({ current_role_id: roleId })
    .eq('user_id', userId)

  if (!withCurrent.error) return

  if (isColumnMissingError(withCurrent.error, 'current_role_id')) {
    throw new Error('users.current_role_id column is missing. Apply multi-role SQL migration first.')
  }

  throw withCurrent.error
}

export async function resolveActiveRoleForIdentity(input: { userId?: string; email?: string }) {
  const { profile } = await loadUserByIdentity(input.userId, input.email)

  if (!profile) {
    return { ok: false as const, code: 'PROFILE_NOT_FOUND' as const, message: 'profile not found' }
  }

  if (profile.is_active === false) {
    return { ok: false as const, code: 'INACTIVE_USER' as const, message: 'inactive user' }
  }

  const legacyRole = (profile.current_role_id || 'applicant') as string

  const assignedRes = await supabaseAdmin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', profile.user_id)

  if (assignedRes.error) {
    if (isRelationMissingError(assignedRes.error)) {
      throw new Error('user_roles table is missing. Apply multi-role SQL migration first.')
    }
    throw assignedRes.error
  }

  const assignedRoles = uniqueRoles((assignedRes.data || []).map((row: { role_id: string }) => row.role_id))

  if (assignedRoles.length === 0) {
    return {
      ok: false as const,
      code: 'NO_ASSIGNED_ROLES' as const,
      message: '利用可能な権限がありません。管理者にお問い合わせください。',
      userId: profile.user_id as string,
    }
  }

  const fallbackRole = pickFallbackRole(assignedRoles)
  const resolvedRole = assignedRoles.includes(legacyRole) ? legacyRole : fallbackRole

  if (resolvedRole !== profile.current_role_id) {
    await updateActiveRole(profile.user_id, resolvedRole)
  }

  return {
    ok: true as const,
    userId: profile.user_id as string,
    currentRoleId: resolvedRole,
    assignedRoleIds: assignedRoles,
    mode: 'multi-role',
  }
}

export async function switchActiveRoleByIdentity(input: { userId?: string; email?: string; roleId: string }) {
  if (!VALID_ROLES.includes(input.roleId as RoleId)) {
    return { ok: false as const, code: 'INVALID_ROLE' as const, message: 'invalid role' }
  }

  const resolved = await resolveActiveRoleForIdentity({ userId: input.userId, email: input.email })
  if (!resolved.ok) return resolved

  if (!resolved.assignedRoleIds.includes(input.roleId)) {
    return { ok: false as const, code: 'ROLE_NOT_ASSIGNED' as const, message: 'role not assigned' }
  }

  await updateActiveRole(resolved.userId, input.roleId)

  return {
    ok: true as const,
    userId: resolved.userId,
    currentRoleId: input.roleId,
    assignedRoleIds: resolved.assignedRoleIds,
    mode: resolved.mode,
  }
}

export async function replaceUserRoles(input: { userId: string; roleIds: string[]; currentRoleId?: string }) {
  const roles = uniqueRoles(input.roleIds)
  if (roles.length === 0) {
    return { ok: false as const, code: 'NO_ASSIGNED_ROLES' as const, message: 'at least one role required' }
  }

  const currentRoleCandidate = input.currentRoleId && roles.includes(input.currentRoleId)
    ? input.currentRoleId
    : pickFallbackRole(roles)

  const delRes = await supabaseAdmin.from('user_roles').delete().eq('user_id', input.userId)
  if (delRes.error) {
    if (isRelationMissingError(delRes.error)) {
      throw new Error('user_roles table is missing. Apply multi-role SQL migration first.')
    }
    throw delRes.error
  }

  const rows = roles.map((roleId) => ({ user_id: input.userId, role_id: roleId }))
  const insRes = await supabaseAdmin.from('user_roles').insert(rows)
  if (insRes.error) throw insRes.error

  await updateActiveRole(input.userId, currentRoleCandidate)

  return {
    ok: true as const,
    userId: input.userId,
    currentRoleId: currentRoleCandidate,
    assignedRoleIds: roles,
    mode: 'multi-role',
  }
}

export async function grantRoleToUser(input: { userId: string; roleId: string; makeCurrent?: boolean }) {
  if (!VALID_ROLES.includes(input.roleId as RoleId)) {
    return { ok: false as const, code: 'INVALID_ROLE' as const, message: 'invalid role' }
  }

  const insRes = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: input.userId, role_id: input.roleId }, { onConflict: 'user_id,role_id' })

  if (insRes.error) {
    if (isRelationMissingError(insRes.error)) {
      throw new Error('user_roles table is missing. Apply multi-role SQL migration first.')
    }
    throw insRes.error
  }

  if (input.makeCurrent) {
    await updateActiveRole(input.userId, input.roleId)
  }

  return { ok: true as const, mode: 'multi-role' }
}
