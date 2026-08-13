'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'

type EditableUser = {
  user_id: string
  email: string
  name?: string
  current_role_id?: string
  assigned_role_ids?: string[]
  is_active?: boolean
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams() as { userId?: string }
  const userId = params.userId
  const [user, setUser] = useState<EditableUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')
  const [assignedRoles, setAssignedRoles] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [name, setName] = useState('')
  const ROLES = ['applicant', 'staff', 'contest_admin', 'staff_primary', 'staff_manager', 'judge', 'admin']

  async function buildAuthHeaders(withJson = false) {
    const sess = await supabase.auth.getSession()
    const accessToken = sess.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    return headers
  }

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setLoading(true)
      try {
        const headers = await buildAuthHeaders(false)
        const res = await fetch(`/api/admin/users?user_id=${userId}`, { headers })
        const d = await res.json()
        if (res.ok && d.user) {
          setUser(d.user)
          const current = d.user.current_role_id || 'applicant'
          const assigned = Array.isArray(d.user.assigned_role_ids) && d.user.assigned_role_ids.length > 0
            ? d.user.assigned_role_ids
            : [current]
          setRole(current)
          setAssignedRoles(assigned)
          setIsActive(Boolean(d.user.is_active))
          setName(d.user.name || '')
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (assignedRoles.length === 0) {
      alert('最低1つのロールを選択してください')
      return
    }
    if (!assignedRoles.includes(role)) {
      alert('現在ロールは割り当てロールの中から選択してください')
      return
    }
    setLoading(true)
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          user_id: userId,
          current_role_id: role,
          assigned_roles: assignedRoles,
          is_active: isActive,
          name,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        alert('更新失敗: ' + (d?.error || res.status))
        return
      }
      router.push('/admin')
    } catch (e: unknown) {
      alert('更新に失敗しました: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    router.push('/admin')
  }

  if (loading) return <div className="max-w-2xl mx-auto alert alert-info">読み込み中...</div>
  if (!user) return <div className="max-w-2xl mx-auto alert alert-warning">ユーザーが見つかりません。</div>

  const toggleAssignedRole = (targetRole: string) => {
    setAssignedRoles((prev) => {
      const exists = prev.includes(targetRole)
      if (exists) {
        const next = prev.filter((r) => r !== targetRole)
        if (next.length === 0) return prev
        if (!next.includes(role)) setRole(next[0])
        return next
      }
      return [...prev, targetRole]
    })
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="card-title text-2xl">ユーザー編集</h2>
            <div className="text-xs text-base-content/60">ID: {user.user_id}</div>
          </div>

          <div className="badge badge-outline">メール: {user.email}</div>

          <form onSubmit={handleUpdate} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text">氏名</span></div>
                <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
              </label>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">割り当てロール</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="label cursor-pointer justify-start gap-3 border rounded-lg px-3 py-2">
                    <input
                      className="checkbox checkbox-primary"
                      type="checkbox"
                      checked={assignedRoles.includes(r)}
                      onChange={() => toggleAssignedRole(r)}
                    />
                    <span className="label-text">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="form-control w-full max-w-xs">
              <div className="label"><span className="label-text">現在ロール</span></div>
              <select className="select select-bordered" value={role} onChange={(e) => setRole(e.target.value)}>
                {assignedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            <label className="label cursor-pointer justify-start gap-3 p-0">
              <input className="checkbox checkbox-primary" id="isActive" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span className="label-text">アカウント有効</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" type="submit" disabled={loading}>保存</button>
              <button className="btn btn-ghost" type="button" onClick={handleCancel}>キャンセル</button>
              <button
                className="btn btn-error btn-outline"
                type="button"
                onClick={async () => {
                  if (!confirm('本当にこのユーザーを削除しますか？この操作は取り消せません。')) return
                  try {
                    setLoading(true)
                    const headers = await buildAuthHeaders(true)
                    const res = await fetch('/api/admin/users', { method: 'DELETE', headers, body: JSON.stringify({ user_id: userId }) })
                    const d = await res.json()
                    if (!res.ok) {
                      alert('削除に失敗しました: ' + (d?.error || res.status))
                      return
                    }
                    router.push('/admin')
                  } catch (e: unknown) {
                    alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)))
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                ユーザー削除
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
