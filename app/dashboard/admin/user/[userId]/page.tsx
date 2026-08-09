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
  const [name, setName] = useState('')
  const [nameKana, setNameKana] = useState('')
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
            setName(d.user.name || '')
            setNameKana(d.user.name_kana || '')
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
      const res = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, role, is_active: isActive, name, name_kana: nameKana }) })
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>ユーザー編集</h2>
        <div style={{ fontSize: 12, color: '#6b7280' }}>ID: {user.user_id}</div>
      </div>

      <div style={{ marginBottom: 14, color: '#374151' }}>
        <div style={{ fontSize: 13 }}>メール: <strong>{user.email}</strong></div>
      </div>

      <form onSubmit={handleUpdate}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>氏名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>フリガナ</label>
            <input value={nameKana} onChange={(e) => setNameKana(e.target.value)} placeholder="ヤマダ タロウ" />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>ロール</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 240 }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="isActive" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <label htmlFor="isActive">アカウント有効</label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>更新</button>
          <button type="button" onClick={handleCancel} style={{ background: 'transparent', color: '#374151', border: '1px solid #e6eef8' }}>キャンセル</button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('本当にこのユーザーを削除しますか？この操作は取り消せません。')) return
              try {
                setLoading(true)
                const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })
                const d = await res.json()
                if (!res.ok) {
                  alert('削除に失敗しました: ' + (d?.error || res.status))
                  return
                }
                router.push('/dashboard/admin')
              } catch (e: any) {
                alert('削除に失敗しました: ' + (e?.message || String(e)))
              } finally {
                setLoading(false)
              }
            }}
            style={{ background: '#ef4444', borderColor: 'transparent', boxShadow: 'none' }}
          >
            ユーザー削除
          </button>
        </div>
      </form>
    </div>
  )
}
