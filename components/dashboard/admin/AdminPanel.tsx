'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type User = {
  user_id: string
  email: string
  name: string
  current_role_id?: string
  assigned_role_ids?: string[]
  guardian_consent: string
  is_active: boolean
  created_at: string
}

type Invite = {
  invite_id: string
  token: string
  target_role: string
  use_count: number
  max_uses: number | null
  expires_at: string
  status: string
}

const ROLES = ['applicant', 'staff', 'contest_admin', 'staff_primary', 'staff_manager', 'judge', 'admin']

export default function AdminPanel() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [filterGuardian, setFilterGuardian] = useState('')
  const [invites, setInvites] = useState<Invite[]>([])
  const [invRole, setInvRole] = useState('staff')
  const [invMaxUses, setInvMaxUses] = useState<number | ''>(1)
  const [invExpiresHours, setInvExpiresHours] = useState(24)
  const [creatingInvite, setCreatingInvite] = useState(false)

  async function buildAuthHeaders(withJson = false) {
    const sess = await supabase.auth.getSession()
    const accessToken = sess.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    return headers
  }

  async function parseJsonOrThrow(res: Response) {
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      throw new Error(`JSON以外のレスポンスを受信しました (status: ${res.status}). ${text.slice(0, 120)}`)
    }
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || `APIエラー: ${res.status}`)
    }
    return data
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (filterRole) params.set('role', filterRole)
      if (filterGuardian) params.set('guardian', filterGuardian)
      const headers = await buildAuthHeaders(false)
      const res = await fetch(`/api/admin/users?${params.toString()}`, { headers })
      const data = await parseJsonOrThrow(res)
      setUsers(data.users || [])
    } catch (e) {
      console.error(e)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchInvites() {
    try {
      const headers = await buildAuthHeaders(false)
      const res = await fetch('/api/admin/invites', { headers })
      const d = await parseJsonOrThrow(res)
      setInvites(d.invites || [])
    } catch (e) {
      console.error(e)
      setInvites([])
    }
  }

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchUsers(), fetchInvites()])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function editUser(user_id: string) {
    router.push(`/admin/user/${user_id}`)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ユーザー管理</h2>

      <section className="card bg-base-100 shadow-xl border border-base-200">
        <div className="card-body">
          <h3 className="card-title">招待リンク発行</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="form-control">
              <div className="label"><span className="label-text">ロール</span></div>
              <select className="select select-bordered" value={invRole} onChange={(e) => setInvRole(e.target.value)}>
                <option value="staff">staff</option>
                <option value="contest_admin">contest_admin</option>
                <option value="staff_primary">staff_primary</option>
                <option value="staff_manager">staff_manager</option>
                <option value="judge">judge</option>
              </select>
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text">最大利用回数</span></div>
              <input className="input input-bordered" type="number" value={invMaxUses === '' ? '' : String(invMaxUses)} onChange={(e) => setInvMaxUses(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0で無制限" />
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text">有効期限（時間）</span></div>
              <input className="input input-bordered" type="number" value={invExpiresHours} onChange={(e) => setInvExpiresHours(Number(e.target.value))} />
            </label>
            <button className="btn btn-primary" onClick={async () => {
              setCreatingInvite(true)
              try {
                const headers = await buildAuthHeaders(true)

                const res = await fetch('/api/admin/invites', { method: 'POST', headers, body: JSON.stringify({ target_role: invRole, max_uses: invMaxUses === '' ? null : invMaxUses, expires_in_hours: invExpiresHours }) })
                const d = await parseJsonOrThrow(res)
                const inviteToken = d.invite?.token
                const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                const url = `${base.replace(/\/$/, '')}/invite?token=${inviteToken}`
                await navigator.clipboard?.writeText(url)
                alert('招待リンクを作成しコピーしました: ' + url)
                fetchInvites()
              } catch (e) {
                console.error(e)
                alert(e instanceof Error ? `作成に失敗しました: ${e.message}` : '作成に失敗しました')
              } finally {
                setCreatingInvite(false)
              }
            }} disabled={creatingInvite}>{creatingInvite ? '発行中...' : '発行'}</button>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-xl border border-base-200">
        <div className="card-body gap-4">
          <h3 className="card-title">ユーザー検索</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input className="input input-bordered" placeholder="検索メール/名前" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select select-bordered" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">すべてのロール</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select className="select select-bordered" value={filterGuardian} onChange={(e) => setFilterGuardian(e.target.value)}>
              <option value="">保護者同意: すべて</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
            <button className="btn btn-primary" onClick={fetchUsers}>検索</button>
          </div>

          {loading ? <div className="alert alert-info">読み込み中...</div> : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>メール</th>
                    <th>氏名</th>
                    <th>現在ロール</th>
                    <th>割当ロール</th>
                    <th>保護者同意</th>
                    <th>有効</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id}>
                      <td>{u.email}</td>
                      <td>{u.name}</td>
                      <td><span className="badge badge-outline">{u.current_role_id || 'applicant'}</span></td>
                      <td>
                        <div className="text-xs">{Array.isArray(u.assigned_role_ids) && u.assigned_role_ids.length > 0 ? u.assigned_role_ids.join(', ') : (u.current_role_id || 'applicant')}</div>
                      </td>
                      <td>{u.guardian_consent}</td>
                      <td>{u.is_active ? '有効' : '無効'}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-sm btn-primary" onClick={() => editUser(u.user_id)}>編集</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard?.writeText(u.email)}>メールコピー</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card bg-base-100 shadow-xl border border-base-200">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="card-title">発行済み招待リンク</h3>
            <button className="btn btn-ghost" onClick={fetchInvites}>更新</button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
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
                    <td className="font-mono text-xs">{inv.token}</td>
                    <td>{inv.target_role}</td>
                    <td>{inv.use_count}</td>
                    <td>{inv.max_uses}</td>
                    <td>{inv.expires_at}</td>
                    <td>{inv.status}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-sm btn-primary" onClick={async () => { const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin; const url = `${base.replace(/\/$/, '')}/invite?token=${inv.token}`; await navigator.clipboard?.writeText(url); alert('コピーしました: ' + url) }}>コピー</button>
                        {inv.status !== 'cancelled' && <button className="btn btn-sm btn-ghost" onClick={async () => { if (!confirm('無効化しますか？')) return; try { const headers = await buildAuthHeaders(true); const res = await fetch('/api/admin/invites', { method: 'PUT', headers, body: JSON.stringify({ invite_id: inv.invite_id, status: 'cancelled' }) }); await parseJsonOrThrow(res); fetchInvites() } catch (e) { alert(e instanceof Error ? `失敗: ${e.message}` : '失敗しました') } }}>無効化</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
