'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function SignOutClient({ role }: { role: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [currentRole, setCurrentRole] = useState(role)
  const [assignedRoles, setAssignedRoles] = useState<string[]>([role])
  const [roleMessage, setRoleMessage] = useState('')

  async function getAccessToken() {
    const sessionRes = await supabase.auth.getSession()
    return sessionRes.data.session?.access_token || null
  }

  async function fetchRoles() {
    setRolesLoading(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const res = await fetch('/api/auth/roles', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setRoleMessage(data?.error || 'ロール情報の取得に失敗しました')
        return
      }

      const nextCurrent = data?.current_role_id || role
      const nextAssigned = Array.isArray(data?.assigned_role_ids) && data.assigned_role_ids.length > 0 ? data.assigned_role_ids : [nextCurrent]

      setCurrentRole(nextCurrent)
      setAssignedRoles(nextAssigned)
      setRoleMessage('')
    } catch (e: unknown) {
      setRoleMessage(e instanceof Error ? e.message : 'ロール情報の取得に失敗しました')
    } finally {
      setRolesLoading(false)
    }
  }

  async function handleRoleSwitch(nextRole: string) {
    if (!nextRole || nextRole === currentRole) return
    setRolesLoading(true)
    setRoleMessage('切替中...')
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setRoleMessage('認証情報が見つかりません。再ログインしてください。')
        return
      }

      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role_id: nextRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRoleMessage(data?.error || 'ロール切替に失敗しました')
        await fetchRoles()
        return
      }

      const targetRole = data?.current_role_id || nextRole
      setCurrentRole(targetRole)
      setRoleMessage('ロールを切り替えました')
      router.push(`/${targetRole}`)
      router.refresh()
    } catch (e: unknown) {
      setRoleMessage(e instanceof Error ? e.message : 'ロール切替に失敗しました')
      await fetchRoles()
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await fetchRoles()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    setLoading(false)
    router.push('/')
  }

  return (
    <div className="card bg-base-100 border border-base-200 mb-4">
      <div className="card-body p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="text-sm">現在のロール: <strong>{currentRole}</strong></div>
          <label className="form-control w-full max-w-xs">
            <div className="label py-0"><span className="label-text text-xs">ロール切替</span></div>
            <select
              className="select select-bordered select-sm"
              value={currentRole}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              disabled={rolesLoading || assignedRoles.length <= 1}
            >
              {assignedRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          {roleMessage ? <div className="text-xs text-base-content/70">{roleMessage}</div> : null}
        </div>
        <button className="btn btn-ghost" onClick={handleSignOut} disabled={loading}>{loading ? 'サインアウト中...' : 'サインアウト'}</button>
      </div>
    </div>
  )
}
