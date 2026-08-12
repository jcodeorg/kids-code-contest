'use client'

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

const CATEGORY_OPTIONS = ['scratch', 'microbit', 'web_app', 'python', 'other']

export default function ApplicantContestPanel() {
  const [works, setWorks] = useState<Work[]>([])
  const [contests, setContests] = useState<Contest[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('scratch')
  const [shortDescription, setShortDescription] = useState('')
  const [detailedDescription, setDetailedDescription] = useState('')
  const [workUrl, setWorkUrl] = useState('')
  const [videoType, setVideoType] = useState('youtube_url')
  const [videoLocation, setVideoLocation] = useState('')

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
      if (contestsRes.ok) setContests(contestsJson.contests || [])
      if (entriesRes.ok) setEntries(entriesJson.entries || [])

      if (!worksRes.ok || !contestsRes.ok || !entriesRes.ok) {
        setStatus(worksJson.error || contestsJson.error || entriesJson.error || 'データ取得に失敗しました')
      }
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAll()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadAll])

  const openContests = useMemo(() => contests.filter((c) => c.status === 'accepting' || c.status === 'draft'), [contests])

  async function createWork(e: React.FormEvent) {
    e.preventDefault()
    setStatus('作品を保存中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/works', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          category,
          short_description: shortDescription,
          detailed_description: detailedDescription,
          work_url: workUrl,
          video_type: videoType,
          video_location: videoLocation,
          thumbnail_url: '',
          has_hardware: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('保存失敗: ' + (data?.error || res.status))
        return
      }

      setTitle('')
      setCategory('scratch')
      setShortDescription('')
      setDetailedDescription('')
      setWorkUrl('')
      setVideoType('youtube_url')
      setVideoLocation('')
      setStatus('作品を保存しました')
      await loadAll()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '保存に失敗しました')
    }
  }

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
          <h3 className="card-title">作品ライブラリ</h3>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={createWork}>
            <input className="input input-bordered" placeholder="作品タイトル" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select className="select select-bordered" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input className="input input-bordered md:col-span-2" placeholder="短い説明" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required />
            <textarea className="textarea textarea-bordered md:col-span-2" placeholder="詳細説明" value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} required />
            <input className="input input-bordered" placeholder="作品URL" value={workUrl} onChange={(e) => setWorkUrl(e.target.value)} required />
            <select className="select select-bordered" value={videoType} onChange={(e) => setVideoType(e.target.value)}>
              <option value="youtube_url">youtube_url</option>
              <option value="mp4_file">mp4_file</option>
            </select>
            <input className="input input-bordered md:col-span-2" placeholder="動画URL / 保存先" value={videoLocation} onChange={(e) => setVideoLocation(e.target.value)} required />
            <div className="md:col-span-2">
              <button className="btn btn-primary" type="submit">作品を保存</button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>タイトル</th><th>カテゴリ</th><th>説明</th><th>URL</th></tr></thead>
              <tbody>
                {works.map((w) => (
                  <tr key={w.work_id}>
                    <td>{w.title}</td>
                    <td>{w.category}</td>
                    <td>{w.short_description}</td>
                    <td className="max-w-xs truncate">{w.work_url}</td>
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
