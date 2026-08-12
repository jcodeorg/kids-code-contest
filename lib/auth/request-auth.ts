import { supabaseAdmin } from '../supabase/server'
import { resolveActiveRoleForIdentity, type RoleId } from './role-security'

export type AuthenticatedIdentity = {
  userId: string
  email?: string
  currentRoleId: string
  assignedRoleIds: string[]
}

export function bearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

export function errorToMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  const maybe = (err as { message?: unknown } | null | undefined)?.message
  if (typeof maybe === 'string') return maybe
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export async function requireAuthWithRoles(req: Request, allowedRoles?: RoleId[]) {
  const accessToken = bearerTokenFromRequest(req)
  if (!accessToken) {
    return { ok: false as const, status: 401, error: 'authorization token required' }
  }

  const authRes = await supabaseAdmin.auth.getUser(accessToken)
  if (authRes.error || !authRes.data.user?.id) {
    return { ok: false as const, status: 401, error: 'invalid token' }
  }

  const authUser = authRes.data.user
  const resolved = await resolveActiveRoleForIdentity({
    userId: authUser.id,
    email: authUser.email || undefined,
  })

  if (!resolved.ok) {
    const status = resolved.code === 'NO_ASSIGNED_ROLES' ? 403 : 404
    return { ok: false as const, status, error: resolved.message }
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(resolved.currentRoleId as RoleId)) {
    return { ok: false as const, status: 403, error: 'role not allowed' }
  }

  const identity: AuthenticatedIdentity = {
    userId: resolved.userId,
    email: authUser.email || undefined,
    currentRoleId: resolved.currentRoleId,
    assignedRoleIds: resolved.assignedRoleIds,
  }

  return { ok: true as const, identity }
}
