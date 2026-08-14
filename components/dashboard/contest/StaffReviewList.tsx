'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Contest = { contest_id: number; title: string; year: number; status: string }
type Entry = { entry_id: number; work_id: string; work_number: number; status: string; primary_avg_score?: number; primary_review_count?: number; final_avg_score?: number; own_total_score?: number | null; works?: { title?: string; thumbnail_url?: string | null } }

export default function StaffReviewList() {
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<'work_number' | 'primary_average' | 'total_score'>('work_number')
  const [sortReady, setSortReady] = useState(false)

  async function loadContests() {
    const res = await fetch('/api/contests')
    const data = await res.json()
    if (!res.ok) {
      setStatus(data?.error || 'コンテスト取得に失敗しました')
      return
    }
    const next = data.contests || []
    setContests(next)
    setContestId((current) => current ?? data.active_contest?.contest_id ?? next[0]?.contest_id ?? null)
  }

  const loadEntries = useCallback(async (targetContestId: number) => {
    setLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`/api/entries?contest_id=${targetContestId}`, { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setStatus(data?.error || '作品一覧取得に失敗しました')
        return
      }
      setEntries(data.entries || [])
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '作品一覧取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadContests()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    if (!contestId) return
    const timerId = window.setTimeout(() => {
      void loadEntries(contestId)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [contestId, loadEntries])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const savedSortKey = window.localStorage.getItem('staff-review-sort-key')
      if (savedSortKey === 'work_number' || savedSortKey === 'primary_average' || savedSortKey === 'total_score') {
        setSortKey(savedSortKey)
      }
      setSortReady(true)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    if (!sortReady) return
    window.localStorage.setItem('staff-review-sort-key', sortKey)
  }, [sortKey, sortReady])

  const sortedEntries = [...entries].sort((left, right) => {
    if (sortKey === 'primary_average') {
      return (right.primary_avg_score ?? -1) - (left.primary_avg_score ?? -1) || left.work_number - right.work_number
    }
    if (sortKey === 'total_score') {
      const leftScore = left.own_total_score ?? -1
      const rightScore = right.own_total_score ?? -1
      return rightScore - leftScore || left.work_number - right.work_number
    }
    return left.work_number - right.work_number
  })

  return (
    <section className="card bg-base-100 shadow-md border border-base-200">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title">私の審査</h2>
          <div className="flex flex-wrap gap-2">
            <select className="select select-bordered" value={contestId ?? ''} onChange={(e) => setContestId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">コンテストを選択</option>
              {contests.map((contest) => <option key={contest.contest_id} value={contest.contest_id}>[{contest.year}] {contest.title}</option>)}
            </select>
            <select className="select select-bordered" value={sortKey} onChange={(e) => setSortKey(e.target.value as 'work_number' | 'primary_average' | 'total_score')}>
              <option value="work_number">作品番号順</option>
              <option value="primary_average">一次平均順</option>
              <option value="total_score">私の採点順</option>
            </select>
            <button className="btn btn-outline" type="button" onClick={() => contestId && void loadEntries(contestId)} disabled={loading || !contestId}>
              更新
            </button>
          </div>
        </div>

        {loading ? <div className="alert alert-info">読み込み中...</div> : null}
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead><tr><th>作品番号</th><th>作品名</th><th>一次平均</th><th>審査員平均</th><th>私の採点</th><th>ステータス</th><th>ボタン</th></tr></thead>
            <tbody>
              {sortedEntries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td>#{entry.work_number}</td>
                  <td>
                    <div className="flex items-center gap-3 min-w-52">
                      {entry.works?.thumbnail_url ? <Image src={entry.works.thumbnail_url} alt="" width={64} height={48} unoptimized className="h-12 w-16 shrink-0 rounded object-cover" /> : <div className="h-12 w-16 shrink-0 rounded bg-base-200" />}
                      <span>{entry.works?.title || '無題'}</span>
                    </div>
                  </td>
                  <td>{entry.primary_review_count ? `${entry.primary_avg_score}(${entry.primary_review_count})` : '-'}</td>
                  <td>{entry.final_avg_score ? entry.final_avg_score : '-'}</td>
                  <td>{entry.own_total_score ?? '-'}</td>
                  <td>{entry.status || '未提出'}</td>
                  <td><Link className="btn btn-sm btn-primary" href={`/staff/reviews/${entry.entry_id}`}>審査</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && entries.length === 0 ? <div className="alert alert-info">対象作品がありません。</div> : null}
        {status ? <div className="alert alert-info text-sm">{status}</div> : null}
      </div>
    </section>
  )
}
