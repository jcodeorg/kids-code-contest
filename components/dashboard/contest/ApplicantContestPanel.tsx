'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Work = {
  work_id: string
  title: string
  category: string
  short_description: string
  work_url: string
}

type Contest = {
  contest_id: number
  title: string
  year: number
  status: string
}

type Entry = {
  entry_id: number
  contest_id: number
  work_id: string
  work_number: number
  status: string
  contests?: { title?: string; year?: number }
  works?: { title?: string }
}

export default function ApplicantContestPanel() {
  const [works, setWorks] = useState<Work[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [selectedContestId, setSelectedContestId] = useState<number | null>(null)
  const [selectedWorkId, setSelectedWorkId] = useState('')

  async function buildAuthHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return headers
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await buildAuthHeaders(false)
      const [worksRes, contestsRes, entriesRes] = await Promise.all([
        fetch('/api/works', { headers }),
        fetch('/api/contests'),
        fetch('/api/entries', { headers }),
      ])

      const worksJson = await worksRes.json()
      const contestsJson = await contestsRes.json()
      const entriesJson = await entriesRes.json()

      if (worksRes.ok) setWorks(worksJson.works || [])
      if (contestsRes.ok) {
        const nextContests = contestsJson.contests || []
        setContests(nextContests)
        const preferredContestId = contestsJson.active_contest?.contest_id ?? nextContests[0]?.contest_id ?? null
        if (preferredContestId && !selectedContestId) {
          setSelectedContestId(preferredContestId)
        }
      }
      if (entriesRes.ok) setEntries(entriesJson.entries || [])

      if (!worksRes.ok || !contestsRes.ok || !entriesRes.ok) {
        setStatus(worksJson.error || contestsJson.error || entriesJson.error || 'データ取得に失敗しました')
      }
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [selectedContestId])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAll()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadAll])

  const openContests = useMemo(() => contests.filter((c) => c.status === 'accepting' || c.status === 'draft'), [contests])

  async function submitEntry() {
    if (!selectedContestId || !selectedWorkId) {
      setStatus('コンテストと作品を選択してください')
      return
    }
    setStatus('応募処理中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({ contest_id: selectedContestId, work_id: selectedWorkId, entry_type: 'individual' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('応募失敗: ' + (data?.error || res.status))
        return
      }
      setStatus(`応募完了: 作品番号 #${data.entry?.work_number ?? '-'}`)
      await loadAll()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '応募に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <section className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="card-title">作品ライブラリ</h3>
            <Link className="btn btn-primary" href="/applicant/works/new">作品を追加</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>タイトル</th><th>カテゴリ</th><th>説明</th><th>URL</th><th>操作</th></tr></thead>
              <tbody>
                {works.map((w) => (
                  <tr key={w.work_id}>
                    <td>{w.title}</td>
                    <td>{w.category}</td>
                    <td>{w.short_description}</td>
                    <td className="max-w-xs truncate">{w.work_url}</td>
                    <td>
                      <Link className="btn btn-sm btn-outline" href={`/applicant/works/${w.work_id}`}>編集</Link>
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
          <h3 className="card-title">コンテスト応募</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="select select-bordered"
              value={selectedContestId ?? ''}
              onChange={(e) => setSelectedContestId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">コンテストを選択</option>
              {openContests.map((c) => (
                <option key={c.contest_id} value={c.contest_id}>[{c.year}] {c.title} ({c.status})</option>
              ))}
            </select>
            <select className="select select-bordered" value={selectedWorkId} onChange={(e) => setSelectedWorkId(e.target.value)}>
              <option value="">応募作品を選択</option>
              {works.map((w) => <option key={w.work_id} value={w.work_id}>{w.title}</option>)}
            </select>
          </div>
          <div>
            <button className="btn btn-primary" onClick={submitEntry}>この作品で応募する</button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>コンテスト</th><th>作品</th><th>作品番号</th><th>状態</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.entry_id}>
                    <td>{entry.contests?.title || entry.contest_id}</td>
                    <td>{entry.works?.title || entry.work_id}</td>
                    <td>#{entry.work_number}</td>
                    <td>{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {loading ? <div className="alert alert-info">読み込み中...</div> : null}
      {status ? <div className="alert alert-info text-sm">{status}</div> : null}
    </div>
  )
}
