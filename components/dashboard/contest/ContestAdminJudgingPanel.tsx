'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Contest = {
  contest_id: number
  title: string
  year: number
  status: string
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
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [phase, setPhase] = useState<'primary' | 'final'>('primary')
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [status, setStatus] = useState('')
  const [topN, setTopN] = useState(20)

  const [newTitle, setNewTitle] = useState('')
  const [newYear, setNewYear] = useState(new Date().getFullYear())
  const [newStatus, setNewStatus] = useState('draft')
  const [newEntryStartAt, setNewEntryStartAt] = useState('')
  const [newEntryEndAt, setNewEntryEndAt] = useState('')
  const [editingContestId, setEditingContestId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editYear, setEditYear] = useState(new Date().getFullYear())
  const [editStatus, setEditStatus] = useState('draft')
  const [editEntryStartAt, setEditEntryStartAt] = useState('')
  const [editEntryEndAt, setEditEntryEndAt] = useState('')

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

  function resetEditDraft() {
    setEditingContestId(null)
    setEditTitle('')
    setEditYear(new Date().getFullYear())
    setEditStatus('draft')
    setEditEntryStartAt('')
    setEditEntryEndAt('')
  }

  function startEditContest(contest: Contest) {
    setEditingContestId(contest.contest_id)
    setEditTitle(contest.title)
    setEditYear(contest.year)
    setEditStatus(contest.status)
    setEditEntryStartAt(contest.entry_start_at || '')
    setEditEntryEndAt(contest.entry_end_at || '')
  }

  async function createContest(e: React.FormEvent) {
    e.preventDefault()
    setStatus('コンテスト作成中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/contests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newTitle,
          year: newYear,
          status: newStatus,
          entry_start_at: newEntryStartAt,
          entry_end_at: newEntryEndAt,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('作成失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('コンテストを作成しました')
      setNewTitle('')
      setNewYear(new Date().getFullYear())
      setNewStatus('draft')
      setNewEntryStartAt('')
      setNewEntryEndAt('')
      await loadContests()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '作成に失敗しました')
    }
  }

  async function updateContest() {
    if (editingContestId === null) return
    setStatus('コンテストを更新中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/admin/contests', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          contest_id: editingContestId,
          title: editTitle,
          year: editYear,
          status: editStatus,
          entry_start_at: editEntryStartAt,
          entry_end_at: editEntryEndAt,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('更新失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('コンテストを更新しました')
      resetEditDraft()
      await loadContests()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '更新に失敗しました')
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
          <h3 className="card-title">コンテスト一覧</h3>
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
                      <button className="btn btn-xs btn-ghost" onClick={() => startEditContest(contest)}>修正</button>
                      <button className="btn btn-xs btn-error" onClick={() => deleteContest(contest)}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editingContestId !== null ? (
        <section className="card bg-base-100 shadow-md border border-base-200">
          <div className="card-body gap-4">
            <h3 className="card-title">コンテスト修正</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="input input-bordered" placeholder="大会名" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              <input className="input input-bordered" type="number" value={editYear} onChange={(e) => setEditYear(Number(e.target.value))} required />
              <select className="select select-bordered" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="draft">draft</option>
                <option value="accepting">accepting</option>
                <option value="primary_judging">primary_judging</option>
                <option value="final_judging">final_judging</option>
                <option value="completed">completed</option>
              </select>
              <div />
              <input className="input input-bordered" type="datetime-local" value={editEntryStartAt} onChange={(e) => setEditEntryStartAt(e.target.value)} required />
              <input className="input input-bordered" type="datetime-local" value={editEntryEndAt} onChange={(e) => setEditEntryEndAt(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={updateContest}>保存</button>
              <button className="btn btn-ghost" onClick={resetEditDraft}>キャンセル</button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body gap-4">
          <h3 className="card-title">コンテスト作成</h3>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={createContest}>
            <input className="input input-bordered" placeholder="大会名" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
            <input className="input input-bordered" type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} required />
            <select className="select select-bordered" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="draft">draft</option>
              <option value="accepting">accepting</option>
              <option value="primary_judging">primary_judging</option>
              <option value="final_judging">final_judging</option>
              <option value="completed">completed</option>
            </select>
            <div />
            <input className="input input-bordered" type="datetime-local" value={newEntryStartAt} onChange={(e) => setNewEntryStartAt(e.target.value)} required />
            <input className="input input-bordered" type="datetime-local" value={newEntryEndAt} onChange={(e) => setNewEntryEndAt(e.target.value)} required />
            <div className="md:col-span-2">
              <button className="btn btn-primary" type="submit">作成</button>
            </div>
          </form>
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
