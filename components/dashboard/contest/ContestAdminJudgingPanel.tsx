'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type Contest = {
  contest_id: number
  title: string
  year: number
  status: string
  is_active?: boolean | null
  entry_start_at?: string | null
  entry_end_at?: string | null
}

type EntryRow = {
  entry_id: number
  contest_id: number
  work_id: string | null
  work_number: number | null
  status: string | null
  entry_type: string | null
  school_name: string | null
  grade: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_consent: 'pending' | 'approved' | 'rejected' | null
  guardian_consent_at: string | null
  users?: { name?: string | null; email?: string | null }
  works?: { title?: string | null; category?: string | null }
}

type ContestAdminJudgingPanelProps = {
  mode?: 'dashboard' | 'entries'
}

export default function ContestAdminJudgingPanel({ mode = 'dashboard' }: ContestAdminJudgingPanelProps) {
  const router = useRouter()
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [status, setStatus] = useState('')

  async function buildAuthHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const loadContests = useCallback(async () => {
    const headers = await buildAuthHeaders(false)
    const res = await fetch('/api/admin/contests', { headers })
    const d = await res.json()
    if (!res.ok) {
      setStatus(d?.error || 'コンテスト取得に失敗しました')
      return
    }

    const contestsData = (Array.isArray(d.contests) ? d.contests : []) as Contest[]
    const activeContestId = d?.active_contest?.contest_id ?? contestsData[0]?.contest_id ?? null

    setContests(contestsData)

    if (activeContestId && (!contestId || !contestsData.some((contest) => contest.contest_id === contestId))) {
      setContestId(activeContestId)
    }
  }, [contestId])

  const loadEntries = useCallback(async (targetContestId: number) => {
    const headers = await buildAuthHeaders(false)
    const res = await fetch(`/api/admin/entries?contest_id=${targetContestId}&view=entries`, { headers })
    const d = await res.json()
    if (!res.ok) {
      setStatus(d?.error || '応募一覧の取得に失敗しました')
      return
    }
    setEntries(d.entries || [])
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadContests()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadContests])

  useEffect(() => {
    if (!contestId) return
    const timerId = window.setTimeout(() => {
      void loadEntries(contestId)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [contestId, loadEntries])

  async function setActiveContest(contest: Contest) {
    setStatus('アクティブコンテストを切り替え中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/contests', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ contest_id: contest.contest_id, is_active: true }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('切替失敗: ' + (d?.error || res.status))
        return
      }
      setStatus(`「${contest.title}」をアクティブコンテストに設定しました`)
      await loadContests()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '切替に失敗しました')
    }
  }

  async function deleteContest(contest: Contest) {
    if (!window.confirm(`「${contest.title}」を削除しますか？`)) return
    setStatus('コンテストを削除中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/contests', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ contest_id: contest.contest_id }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('削除失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('コンテストを削除しました')
      if (contestId === contest.contest_id) {
        const next = contests.filter((item) => item.contest_id !== contest.contest_id)
        setContestId(next[0]?.contest_id ?? null)
      }
      await loadContests()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const consentLabelMap: Record<string, string> = {
    pending: '未確認',
    approved: '同意済み',
    rejected: '拒否',
  }

  return (
    <div className="space-y-6">
      {mode === 'dashboard' ? (
        <section className="card bg-base-100 shadow-md border border-base-200">
          <div className="card-body gap-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="card-title">コンテスト一覧</h3>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push('/contest_admin/new')}>
                新規作成
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>大会名</th>
                    <th>年度</th>
                    <th>状態</th>
                    <th>募集期間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {contests.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-base-content/60">登録されたコンテストはありません</td></tr>
                  ) : contests.map((contest) => (
                    <tr key={contest.contest_id}>
                      <td>{contest.title}</td>
                      <td>{contest.year}</td>
                      <td>{contest.status}</td>
                      <td>
                        {contest.is_active ? <span className="badge badge-success">アクティブ</span> : <span className="badge badge-ghost">通常</span>}
                      </td>
                      <td>
                        {contest.entry_start_at && contest.entry_end_at
                          ? `${new Date(contest.entry_start_at).toLocaleString()} ~ ${new Date(contest.entry_end_at).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="space-x-2">
                        <button className="btn btn-xs btn-ghost" onClick={() => router.push(`/contest_admin/${contest.contest_id}/edit`)}>
                          編集
                        </button>
                        {!contest.is_active ? (
                          <button className="btn btn-xs btn-primary" onClick={() => setActiveContest(contest)}>有効化</button>
                        ) : null}
                        <button className="btn btn-xs btn-error" onClick={() => deleteContest(contest)}>削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative max-w-2xl flex-1">
              <select
                className="w-full appearance-none rounded-2xl border border-base-300 bg-base-100 px-4 py-3 pr-12 text-xl font-bold text-base-content shadow-sm transition focus:border-primary focus:outline-none sm:text-2xl"
                value={contestId ?? ''}
                onChange={(e) => setContestId(e.target.value ? Number(e.target.value) : null)}
                aria-label="コンテスト選択"
              >
                {contests.map((c) => (
                  <option key={c.contest_id} value={c.contest_id}>{c.title}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base-content/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>応募者</th>
                  <th>学校/学年</th>
                  <th>応募作品</th>
                  <th>作品ID</th>
                  <th>保護者</th>
                  <th>同意状況</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      {contestId ? '選択中のコンテストには応募データがありません' : 'コンテストを選択してください'}
                    </td>
                  </tr>
                ) : entries.map((entry) => (
                  <tr key={entry.entry_id}>
                    <td>
                      <div className="font-semibold">{entry.users?.name || '-'}</div>
                      <div className="text-xs text-base-content/70">{entry.users?.email || '-'}</div>
                    </td>
                    <td>
                      <div>{entry.school_name || '-'}</div>
                      <div className="text-xs text-base-content/70">{entry.grade || '-'}</div>
                    </td>
                    <td>{entry.works?.title || '未選択'}</td>
                    <td>{entry.work_id || '-'}</td>
                    <td>
                      <div>{entry.guardian_name || '-'}</div>
                      <div className="text-xs text-base-content/70">{entry.guardian_email || '-'}</div>
                    </td>
                    <td>
                      <span className={`badge ${entry.guardian_consent === 'approved' ? 'badge-success' : entry.guardian_consent === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                        {entry.guardian_consent ? consentLabelMap[entry.guardian_consent] ?? entry.guardian_consent : '未確認'}
                      </span>
                    </td>
                    <td>{entry.status || 'draft'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {status ? <div className="alert alert-info text-sm">{status}</div> : null}
    </div>
  )
}
