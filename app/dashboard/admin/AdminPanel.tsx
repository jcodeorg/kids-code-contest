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

  useEffect(() => {
    fetchUsers()
  }, [])

  function editUser(user_id: string) {
    // navigate to edit page
    window.location.href = `/dashboard/admin/user/${user_id}`
  }

  return (
    <div>
      <h2>ユーザー管理</h2>
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
    </div>
  )
}
