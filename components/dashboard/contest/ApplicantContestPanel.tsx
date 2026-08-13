'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
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

type ApplicantContestPanelProps = {
  contests: Contest[]
  selectedContestId: number | null
  onSelectedContestIdChange: (nextContestId: number | null) => void
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

export default function ApplicantContestPanel({ contests, selectedContestId, onSelectedContestIdChange }: ApplicantContestPanelProps) {
  const [works, setWorks] = useState<Work[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

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
        const preferredContestId = contestsJson.active_contest?.contest_id ?? contests[0]?.contest_id ?? null
        if (preferredContestId && !selectedContestId) {
          onSelectedContestIdChange(preferredContestId)
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
  }, [contests, onSelectedContestIdChange, selectedContestId])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAll()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadAll])

  async function submitEntry(targetWorkId?: string, mode: 'create' | 'replace' = 'create') {
    const effectiveWorkId = targetWorkId || selectedWorkId
    if (!selectedContestId || !effectiveWorkId) {
      setStatus('コンテストと作品を選択してください')
      return
    }

    const currentEntry = entries.find((entry) => entry.contest_id === selectedContestId)
    const isReplace = mode === 'replace' && !!currentEntry

    setStatus(isReplace ? '応募作品を変更中...' : '応募処理中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/entries', {
        method: isReplace ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({
          contest_id: selectedContestId,
          work_id: effectiveWorkId,
          entry_id: currentEntry?.entry_id,
          entry_type: 'individual',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus((isReplace ? '変更失敗' : '応募失敗') + ': ' + (data?.error || res.status))
        return
      }
      setSelectedWorkId(effectiveWorkId)
      setStatus(isReplace ? `応募作品を変更しました: 作品番号 #${data.entry?.work_number ?? '-'}` : `応募完了: 作品番号 #${data.entry?.work_number ?? '-'}`)
      await loadAll()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '処理に失敗しました')
    }
  }

  async function cancelEntry() {
    if (!selectedContestId) {
      setStatus('対象コンテストを選択してください')
      return
    }

    const currentEntry = entries.find((entry) => entry.contest_id === selectedContestId)
    if (!currentEntry) {
      setStatus('応募中の作品はありません')
      return
    }

    setStatus('応募を取り消し中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/entries', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          contest_id: selectedContestId,
          entry_id: currentEntry.entry_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('応募の取り消しに失敗しました: ' + (data?.error || res.status))
        return
      }
      setSelectedWorkId('')
      setStatus(`応募を取り消しました: 作品番号は解除されました`)
      await loadAll()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '処理に失敗しました')
    }
  }

  const selectedContestName = selectedContestId ? contests.find((contest) => contest.contest_id === selectedContestId)?.title || '選択中のコンテスト' : '未選択'

  return (
    <div className="space-y-6">
      <section className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="card-title">作品ライブラリ</h3>
            <Link className="btn btn-primary" href="/applicant/works/new">作品を追加</Link>
          </div>

          <div className="rounded-box bg-base-200 p-3 text-sm flex flex-wrap items-center justify-between gap-3">
            <span>対象コンテスト: <strong>{selectedContestName}</strong></span>
            {selectedContestId ? (() => {
              const currentEntry = entries.find((entry) => entry.contest_id === selectedContestId)
              return currentEntry?.work_id ? <span>応募中の作品: <strong>#{currentEntry.work_number ?? '-'}</strong></span> : <span>応募中の作品: <strong>未設定</strong></span>
            })() : <span>応募中の作品: <strong>未選択</strong></span>}
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>タイトル</th><th>カテゴリ</th><th>説明</th><th>URL</th><th>応募状況</th><th>操作</th></tr></thead>
              <tbody>
                {works.map((w) => {
                  const selectedContestEntry = selectedContestId ? entries.find((entry) => entry.contest_id === selectedContestId) : undefined
                  const isCurrentEntry = !!selectedContestEntry && !!selectedContestEntry.work_id && selectedContestEntry.work_id === w.work_id
                  const statusLabel = isCurrentEntry
                    ? `応募済み (#${selectedContestEntry.work_number ?? '-'})`
                    : (selectedContestEntry?.work_id ? `別作品を応募済み (#${selectedContestEntry.work_number ?? '-'})` : '未応募')

                  return (
                    <tr key={w.work_id}>
                      <td>
                        {w.title}
                        {isCurrentEntry && Number.isFinite(selectedContestEntry?.work_number) ? ` - [#${selectedContestEntry.work_number}]` : ''}
                      </td>
                      <td>{w.category}</td>
                      <td>{w.short_description}</td>
                      <td className="max-w-xs truncate">{w.work_url}</td>
                      <td>{statusLabel}</td>
                      <td className="flex flex-wrap gap-2">
                        {isCurrentEntry ? (
                          <button className="btn btn-sm btn-warning" type="button" onClick={() => void cancelEntry()}>
                            応募をやめる
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => void submitEntry(w.work_id, selectedContestEntry ? 'replace' : 'create')}
                          >
                            これを応募する
                          </button>
                        )}
                        <Link className="btn btn-sm btn-outline" href={`/applicant/works/${w.work_id}`}>編集</Link>
                      </td>
                    </tr>
                  )
                })}
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
