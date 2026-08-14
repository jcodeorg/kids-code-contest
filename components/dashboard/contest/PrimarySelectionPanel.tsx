'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Contest = { contest_id: number; title: string; year: number; status: string }
type RankingEntry = {
  entry_id: number
  work_number: number
  is_primary_passed: boolean
  avg_score: number
  works?: { title?: string; category?: string; thumbnail_url?: string | null }
}

export default function PrimarySelectionPanel() {
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [topN, setTopN] = useState('20')
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  async function authHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const loadRanking = useCallback(async (targetContestId: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/entries?contest_id=${targetContestId}&phase=primary&view=ranking`, { headers: await authHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setStatus(data?.error || '一次審査ランキングの取得に失敗しました')
        return
      }
      const nextRanking = (data.ranking || []).slice().sort((left: RankingEntry, right: RankingEntry) => right.avg_score - left.avg_score || left.work_number - right.work_number)
      setRanking(nextRanking)
      setSelectedEntryIds(nextRanking.filter((entry: RankingEntry) => entry.is_primary_passed).map((entry: RankingEntry) => entry.entry_id))
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '一次審査ランキングの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void (async () => {
        const res = await fetch('/api/contests')
        const data = await res.json()
        if (!res.ok) {
          setStatus(data?.error || 'コンテスト取得に失敗しました')
          return
        }
        const nextContests = data.contests || []
        setContests(nextContests)
        setContestId(data.active_contest?.contest_id ?? nextContests[0]?.contest_id ?? null)
      })()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    if (!contestId) return
    const timerId = window.setTimeout(() => {
      void loadRanking(contestId)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [contestId, loadRanking])

  function selectTopEntries() {
    const count = Math.max(0, Math.min(ranking.length, Number(topN) || 0))
    setSelectedEntryIds(ranking.slice(0, count).map((entry) => entry.entry_id))
  }

  function toggleEntry(entryId: number) {
    setSelectedEntryIds((current) => current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId])
  }

  async function markPrimaryPassed() {
    if (!contestId) return
    setSaving(true)
    setStatus('一次審査通過作品を更新中...')
    try {
      const res = await fetch('/api/admin/entries', {
        method: 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify({ action: 'mark_primary_passed', contest_id: contestId, entry_ids: selectedEntryIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(data?.error || '一次審査通過作品の更新に失敗しました')
        return
      }
      setStatus(`${data.passed_entry_ids?.length ?? selectedEntryIds.length}作品を一次審査通過にしました`)
      await loadRanking(contestId)
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '一次審査通過作品の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card border border-base-200 bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="card-title">一次審査通過作品</h1>
            <p className="text-sm text-base-content/65">一次平均の上位作品を確認して、二次審査へ進めます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select select-bordered" value={contestId ?? ''} onChange={(e) => setContestId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">コンテストを選択</option>
              {contests.map((contest) => <option key={contest.contest_id} value={contest.contest_id}>[{contest.year}] {contest.title}</option>)}
            </select>
            <label className="input input-bordered flex items-center gap-2">
              上位
              <input className="w-16" type="number" min="0" max={ranking.length} value={topN} onChange={(e) => setTopN(e.target.value)} aria-label="上位作品数" />
              件
            </label>
            <button className="btn btn-outline" type="button" onClick={selectTopEntries} disabled={loading || !ranking.length}>上位をチェック</button>
            <button className="btn btn-primary" type="button" onClick={() => void markPrimaryPassed()} disabled={saving || loading || !contestId}>
              {saving ? '確定中...' : 'チェック状態を確定'}
            </button>
          </div>
        </div>

        {loading ? <div className="alert alert-info">読み込み中...</div> : null}
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead><tr><th>通過</th><th>順位</th><th>作品番号</th><th>作品名</th><th>一次平均</th></tr></thead>
            <tbody>
              {ranking.map((entry, index) => (
                <tr key={entry.entry_id} className={selectedEntryIds.includes(entry.entry_id) ? 'bg-success/10' : undefined}>
                  <td>
                    <input className="checkbox checkbox-success" type="checkbox" checked={selectedEntryIds.includes(entry.entry_id)} onChange={() => toggleEntry(entry.entry_id)} aria-label={`${entry.works?.title || '作品'}を一次審査通過にする`} />
                  </td>
                  <td>{index + 1}</td>
                  <td>#{entry.work_number}</td>
                  <td>
                    <div className="flex items-center gap-3 min-w-52">
                      {entry.works?.thumbnail_url ? <Image src={entry.works.thumbnail_url} alt="" width={64} height={48} unoptimized className="h-12 w-16 shrink-0 rounded object-cover" /> : <div className="h-12 w-16 shrink-0 rounded bg-base-200" />}
                      <span>{entry.works?.title || '無題'}</span>
                    </div>
                  </td>
                  <td>{entry.avg_score || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && ranking.length === 0 ? <div className="alert alert-info">対象作品がありません。</div> : null}
        {status ? <div className="alert alert-info text-sm">{status}</div> : null}
      </div>
    </section>
  )
}
