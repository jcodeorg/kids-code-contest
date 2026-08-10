'use client'

import React, { useEffect, useState } from 'react'

type User = {
  user_id: string
  email: string
  name: string
  role: string
  guardian_consent: string
  is_active: boolean
  created_at: string
}

const ROLES = ['applicant', 'staff_primary', 'staff_manager', 'judge', 'admin']

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [filterGuardian, setFilterGuardian] = useState('')
  const [invites, setInvites] = useState<any[]>([])
  const [invRole, setInvRole] = useState('staff_primary')
  const [invMaxUses, setInvMaxUses] = useState<number | ''>(1)
  const [invExpiresHours, setInvExpiresHours] = useState(24)
  const [creatingInvite, setCreatingInvite] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (filterRole) params.set('role', filterRole)
      if (filterGuardian) params.set('guardian', filterGuardian)
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await res.json()
      setUsers(data.users || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInvites() {
    try {
      const res = await fetch('/api/admin/invites')
      const d = await res.json()
      setInvites(d.invites || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchInvites()
  }, [])

  function editUser(user_id: string) {
    // navigate to edit page
    window.location.href = `/dashboard/admin/user/${user_id}`
  }

  return (
    <div>
      <h2>ユーザー管理</h2>
      <section style={{ marginBottom: 20, padding: 12, borderRadius: 10, background: '#f8fafc' }}>
        <h3 style={{ marginTop: 0 }}>招待リンク発行</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={invRole} onChange={(e) => setInvRole(e.target.value)}>
            <option value="staff_primary">staff_primary</option>
            <option value="staff_manager">staff_manager</option>
            <option value="judge">judge</option>
          </select>
          <input type="number" value={invMaxUses as any} onChange={(e) => setInvMaxUses(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 120 }} placeholder="max uses (0 unlimited)" />
          <input type="number" value={invExpiresHours} onChange={(e) => setInvExpiresHours(Number(e.target.value))} style={{ width: 120 }} />
          <button onClick={async () => {
            setCreatingInvite(true)
            try {
              const res = await fetch('/api/admin/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_role: invRole, max_uses: invMaxUses === '' ? null : invMaxUses, expires_in_hours: invExpiresHours }) })
              const d = await res.json()
              if (!res.ok) {
                alert('作成失敗: ' + (d?.error || res.status))
                return
              }
              const token = d.invite?.token
              const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
              const url = `${base.replace(/\/$/, '')}/invite?token=${token}`
              await navigator.clipboard?.writeText(url)
              alert('招待リンクを作成しコピーしました: ' + url)
              fetchInvites()
            } catch (e) {
              console.error(e)
              alert('作成に失敗しました')
            } finally {
              setCreatingInvite(false)
            }
          }} disabled={creatingInvite}>発行</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>有効期限(時間)</div>
      </section>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="検索メール/名前" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">すべてのロール</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={filterGuardian} onChange={(e) => setFilterGuardian(e.target.value)}>
          <option value="">保護者同意: すべて</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <button onClick={fetchUsers}>検索</button>
      </div>

      {loading ? <p>読み込み中...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>メール</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>氏名</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>ロール</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>保護者同意</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>有効</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td style={{ padding: '6px 4px' }}>{u.email}</td>
                <td style={{ padding: '6px 4px' }}>{u.name}</td>
                <td style={{ padding: '6px 4px' }}>{u.role}</td>
                <td style={{ padding: '6px 4px' }}>{u.guardian_consent}</td>
                <td style={{ padding: '6px 4px' }}>{u.is_active ? '有効' : '無効'}</td>
                <td style={{ padding: '6px 4px', display: 'flex', gap: 8 }}>
                  <button onClick={() => editUser(u.user_id)}>編集</button>
                  <button onClick={() => navigator.clipboard?.writeText(u.email)}>メールコピー</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section style={{ marginTop: 20 }}>
        <h3>発行済み招待リンク</h3>
        <button onClick={fetchInvites}>更新</button>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th>token</th>
              <th>role</th>
              <th>uses</th>
              <th>max</th>
              <th>expires_at</th>
              <th>status</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.invite_id}>
                <td style={{ padding: '6px 4px' }}>{inv.token}</td>
                <td style={{ padding: '6px 4px' }}>{inv.target_role}</td>
                <td style={{ padding: '6px 4px' }}>{inv.use_count}</td>
                <td style={{ padding: '6px 4px' }}>{inv.max_uses}</td>
                <td style={{ padding: '6px 4px' }}>{inv.expires_at}</td>
                <td style={{ padding: '6px 4px' }}>{inv.status}</td>
                <td style={{ padding: '6px 4px', display: 'flex', gap: 8 }}>
                  <button onClick={async () => { const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin; const url = `${base.replace(/\/$/, '')}/invite?token=${inv.token}`; await navigator.clipboard?.writeText(url); alert('コピーしました: ' + url) }}>コピー</button>
                  {inv.status !== 'cancelled' && <button onClick={async () => { if (!confirm('無効化しますか？')) return; const res = await fetch('/api/admin/invites', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_id: inv.invite_id, status: 'cancelled' }) }); const d = await res.json(); if (!res.ok) { alert('失敗: ' + (d?.error || res.status)); return } fetchInvites() }}>無効化</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
