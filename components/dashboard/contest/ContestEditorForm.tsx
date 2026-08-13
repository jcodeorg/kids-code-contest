'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type Contest = {
  contest_id: number
  title: string
  year: number
  status: string
  entry_start_at?: string | null
  entry_end_at?: string | null
}

export default function ContestEditorForm({ mode, contestId }: { mode: 'create' | 'edit'; contestId?: number }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [status, setStatus] = useState('draft')
  const [isActive, setIsActive] = useState(false)
  const [entryStartAt, setEntryStartAt] = useState('')
  const [entryEndAt, setEntryEndAt] = useState('')
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function buildAuthHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || null
    const headers: Record<string, string> = withJson ? { 'Content-Type': 'application/json' } : {}
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  useEffect(() => {
    if (mode !== 'edit' || !contestId) return

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true)
          const headers = await buildAuthHeaders()
          const res = await fetch('/api/admin/contests', { headers })
          const data = await res.json()
          if (!res.ok) {
            setMessage(data?.error || 'コンテスト取得に失敗しました')
            return
          }

          const contest = (data.contests || []).find((item: Contest) => item.contest_id === contestId)
          if (!contest) {
            setMessage('対象のコンテストが見つかりません')
            return
          }

          setTitle(contest.title || '')
          setYear(contest.year || new Date().getFullYear())
          setStatus(contest.status || 'draft')
          setIsActive(Boolean(contest.is_active))
          setEntryStartAt(contest.entry_start_at ? contest.entry_start_at.slice(0, 16) : '')
          setEntryEndAt(contest.entry_end_at ? contest.entry_end_at.slice(0, 16) : '')
        } catch (err: unknown) {
          setMessage(err instanceof Error ? err.message : '取得に失敗しました')
        } finally {
          setLoading(false)
        }
      })()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [contestId, mode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      setMessage('タイトルを入力してください')
      return
    }
    if (!entryStartAt || !entryEndAt) {
      setMessage('募集開始日と募集終了日を入力してください')
      return
    }

    setSaving(true)
    setMessage(mode === 'create' ? '作成中...' : '更新中...')

    try {
      const headers = await buildAuthHeaders(true)
      const method = mode === 'create' ? 'POST' : 'PUT'
      const body: Record<string, unknown> = {
        title,
        year,
        status,
        is_active: isActive,
        entry_start_at: entryStartAt,
        entry_end_at: entryEndAt,
      }

      if (mode === 'edit' && contestId) body.contest_id = contestId

      const res = await fetch('/api/admin/contests', {
        method,
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage('保存失敗: ' + (data?.error || res.status))
        return
      }

      router.push('/contest_admin')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="alert alert-info">読み込み中...</div>

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-3xl mx-auto card bg-base-100 border border-base-200 shadow-md">
        <div className="card-body gap-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="card-title text-2xl">{mode === 'create' ? 'コンテストを作成' : 'コンテストを編集'}</h1>
            <button type="button" className="btn btn-ghost" onClick={() => router.push('/contest_admin')}>戻る</button>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">大会名</label>
              <input className="input input-bordered w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">年度</label>
              <input className="input input-bordered w-full" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">状態</label>
              <select className="select select-bordered w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">draft</option>
                <option value="accepting">accepting</option>
                <option value="primary_judging">primary_judging</option>
                <option value="final_judging">final_judging</option>
                <option value="completed">completed</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-primary" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span>このコンテストをアクティブコンテストとして設定する</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">募集開始</label>
              <input className="input input-bordered w-full" type="datetime-local" value={entryStartAt} onChange={(e) => setEntryStartAt(e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">募集終了</label>
              <input className="input input-bordered w-full" type="datetime-local" value={entryEndAt} onChange={(e) => setEntryEndAt(e.target.value)} required />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? '保存中...' : '保存する'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => router.push('/contest_admin')}>キャンセル</button>
            </div>
          </form>

          {message ? <div className="alert alert-info text-sm">{message}</div> : null}
        </div>
      </div>
    </div>
  )
}
