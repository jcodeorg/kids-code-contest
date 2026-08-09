'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams() as { userId?: string }
  const userId = params.userId
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState(true)
  const ROLES = ['applicant', 'staff_primary', 'staff_manager', 'judge', 'admin']

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users?user_id=${userId}`)
        const d = await res.json()
        if (res.ok && d.user) {
          setUser(d.user)
          setRole(d.user.role)
          setIsActive(Boolean(d.user.is_active))
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, role, is_active: isActive }) })
      const d = await res.json()
      if (!res.ok) {
        alert('更新失敗: ' + (d?.error || res.status))
        return
      }
      router.push('/dashboard/admin')
    } catch (e: any) {
      alert('更新に失敗しました: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    router.push('/dashboard/admin')
  }

  if (loading) return <div className="card">読み込み中...</div>
  if (!user) return <div className="card">ユーザーが見つかりません。</div>

  return (
    <div className="card">
      <h2>ユーザー編集</h2>
      <p>メール: {user.email}</p>
      <p>氏名: {user.name}</p>
      <form onSubmit={handleUpdate}>
        <div style={{ marginBottom: 8 }}>
          <label>ロール</label>
          <br />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>有効</label>
          <br />
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>更新</button>
          <button type="button" onClick={handleCancel}>キャンセル</button>
        </div>
      </form>
    </div>
  )
}
