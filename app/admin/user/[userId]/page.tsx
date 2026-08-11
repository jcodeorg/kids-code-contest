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
      router.push('/admin')
    } catch (e: any) {
      alert('更新に失敗しました: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    router.push('/admin')
  }

  if (loading) return <div className="max-w-2xl mx-auto alert alert-info">読み込み中...</div>
  if (!user) return <div className="max-w-2xl mx-auto alert alert-warning">ユーザーが見つかりません。</div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text">氏名</span></div>
                <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text">フリガナ</span></div>
                <input className="input input-bordered w-full" value={nameKana} onChange={(e) => setNameKana(e.target.value)} placeholder="ヤマダ タロウ" />
              </label>
            </div>

            <label className="form-control w-full max-w-xs">
              <div className="label"><span className="label-text">ロール</span></div>
              <select className="select select-bordered" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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
                    const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })
                    const d = await res.json()
                    if (!res.ok) {
                      alert('削除に失敗しました: ' + (d?.error || res.status))
                      return
                    }
                    router.push('/admin')
                  } catch (e: any) {
                    alert('削除に失敗しました: ' + (e?.message || String(e)))
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
