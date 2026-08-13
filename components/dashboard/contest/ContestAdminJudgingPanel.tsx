'use client'

import { useCallback, useEffect, useState } from 'react'
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

type RankingRow = {
  entry_id: number
  work_number: number
  avg_score: number
  rank: number | null
  is_primary_passed: boolean
  works?: { title?: string; category?: string }
  users?: { name?: string }
}

export default function ContestAdminJudgingPanel() {
  const router = useRouter()
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [phase, setPhase] = useState<'primary' | 'final'>('primary')
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [status, setStatus] = useState('')
  const [topN, setTopN] = useState(20)

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
    setContests(d.contests || [])
    if (!contestId && (d.contests || [])[0]?.contest_id) {
      setContestId((d.contests || [])[0].contest_id)
    }
  }, [contestId])

  const loadRanking = useCallback(async (targetContestId: number, targetPhase: 'primary' | 'final') => {
    const headers = await buildAuthHeaders(false)
    const res = await fetch(`/api/admin/entries?contest_id=${targetContestId}&phase=${targetPhase}`, { headers })
    const d = await res.json()
    if (!res.ok) {
      setStatus(d?.error || 'ランキング取得に失敗しました')
      return
    }
    setRanking(d.ranking || [])
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
      void loadRanking(contestId, phase)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [contestId, phase, loadRanking])

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

  async function markPrimaryPassed() {
    if (!contestId) return
    setStatus('一次通過フラグを更新中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'mark_primary_passed', contest_id: contestId, top_n: topN }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('更新失敗: ' + (d?.error || res.status))
        return
      }
      setStatus(`一次通過を更新しました（${(d.passed_entry_ids || []).length}件）`)
      await loadRanking(contestId, 'primary')
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  async function publishComments() {
    if (!contestId) return
    setStatus('公開コメントを一括公開中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'publish_final_comments', contest_id: contestId }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('公開失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('公開コメントを一括公開しました')
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '公開に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
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
                  <tr><td colSpan={5} className="text-center text-base-content/60">登録されたコンテストはありません</td></tr>
                ) : contests.map((contest) => (
                  <tr key={contest.contest_id}>
                    <td>{contest.title}</td>
                    <td>{contest.year}</td>
                    <td>{contest.status}</td>
                    <td>
                      {contest.entry_start_at && contest.entry_end_at
                        ? `${new Date(contest.entry_start_at).toLocaleString()} ~ ${new Date(contest.entry_end_at).toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="space-x-2">
                      <button className="btn btn-xs btn-ghost" onClick={() => router.push(`/contest_admin/${contest.contest_id}/edit`)}>
                        編集
                      </button>
                      <button className="btn btn-xs btn-error" onClick={() => deleteContest(contest)}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body gap-4">
          <h3 className="card-title">集計・進出管理</h3>
          <div className="flex flex-wrap gap-3 items-center">
            <select className="select select-bordered" value={contestId ?? ''} onChange={(e) => setContestId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">コンテストを選択</option>
              {contests.map((c) => <option key={c.contest_id} value={c.contest_id}>[{c.year}] {c.title}</option>)}
            </select>
            <select className="select select-bordered" value={phase} onChange={(e) => setPhase(e.target.value as 'primary' | 'final')}>
              <option value="primary">primary</option>
              <option value="final">final</option>
            </select>
            <button className="btn btn-ghost" onClick={() => contestId && loadRanking(contestId, phase)}>更新</button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input className="input input-bordered w-28" type="number" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
            <button className="btn btn-primary" onClick={markPrimaryPassed}>上位N件を一次通過に設定</button>
            <button className="btn btn-outline" onClick={publishComments}>二次公開コメントを一括公開</button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>順位</th>
                  <th>作品番号</th>
                  <th>作品</th>
                  <th>応募者</th>
                  <th>平均点</th>
                  <th>一次通過</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.entry_id}>
                    <td>{row.rank || '-'}</td>
                    <td>#{row.work_number}</td>
                    <td>{row.works?.title || '-'}</td>
                    <td>{row.users?.name || '-'}</td>
                    <td>{row.avg_score}</td>
                    <td>{row.is_primary_passed ? 'YES' : 'NO'}</td>
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
