'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Contest = {
  contest_id: number
  title: string
  year: number
  status: string
}

type Entry = {
  entry_id: number
  work_number: number
  is_primary_passed: boolean
  primary_avg_score: number
  final_avg_score: number
  school_name?: string | null
  grade?: string | null
  works?: { title?: string; category?: string; short_description?: string; work_url?: string }
  users?: { name?: string }
}

type Phase = 'primary' | 'final'

export default function ReviewPanel({ phase, roleLabel }: { phase: Phase; roleLabel: string }) {
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState('')
  const [savingEntryId, setSavingEntryId] = useState<number | null>(null)

  async function buildAuthHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  async function loadContests() {
    const res = await fetch('/api/contests')
    const d = await res.json()
    if (res.ok) {
      const nextContests = d.contests || []
      setContests(nextContests)
      const preferred = d.active_contest?.contest_id ?? nextContests[0]?.contest_id
      if (preferred) setContestId(preferred)
    }
  }

  const loadEntries = useCallback(async (targetContestId: number) => {
    const headers = await buildAuthHeaders(false)
    const res = await fetch(`/api/entries?contest_id=${targetContestId}`, { headers })
    const d = await res.json()
    if (!res.ok) {
      setStatus(d?.error || '作品一覧取得に失敗しました')
      return
    }
    setEntries(d.entries || [])
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

  async function saveEvaluation(entryId: number, values: {
    scoreOriginality: string
    scoreSkill: string
    scoreEffort: string
    scorePurpose: string
    scoreOther: string
    publicComment: string
    privateComment: string
  }) {
    setSavingEntryId(entryId)
    setStatus('保存中...')
    try {
      const headers = await buildAuthHeaders(true)
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_id: entryId,
          phase,
          score_originality: Number(values.scoreOriginality),
          score_skill: Number(values.scoreSkill),
          score_effort: Number(values.scoreEffort),
          score_purpose: Number(values.scorePurpose),
          score_other: Number(values.scoreOther),
          public_comment: values.publicComment,
          private_comment: values.privateComment,
          status: 'completed',
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('保存失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('保存しました')
      if (contestId) await loadEntries(contestId)
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSavingEntryId(null)
    }
  }

  return (
    <section className="card bg-base-100 shadow-md border border-base-200">
      <div className="card-body gap-4">
        <h3 className="card-title">{roleLabel}</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <select className="select select-bordered" value={contestId ?? ''} onChange={(e) => setContestId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">コンテストを選択</option>
            {contests.map((c) => (
              <option key={c.contest_id} value={c.contest_id}>[{c.year}] {c.title}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={() => contestId && loadEntries(contestId)}>更新</button>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => (
            <ReviewCard key={entry.entry_id} entry={entry} phase={phase} saving={savingEntryId === entry.entry_id} onSave={saveEvaluation} />
          ))}
          {entries.length === 0 ? <div className="alert alert-info">対象作品がありません。</div> : null}
        </div>

        {status ? <div className="alert alert-info text-sm">{status}</div> : null}
      </div>
    </section>
  )
}

function ReviewCard({
  entry,
  phase,
  saving,
  onSave,
}: {
  entry: Entry
  phase: Phase
  saving: boolean
  onSave: (entryId: number, values: {
    scoreOriginality: string
    scoreSkill: string
    scoreEffort: string
    scorePurpose: string
    scoreOther: string
    publicComment: string
    privateComment: string
  }) => Promise<void>
}) {
  const [scoreOriginality, setScoreOriginality] = useState('3')
  const [scoreSkill, setScoreSkill] = useState('3')
  const [scoreEffort, setScoreEffort] = useState('3')
  const [scorePurpose, setScorePurpose] = useState('3')
  const [scoreOther, setScoreOther] = useState('3.0')
  const [publicComment, setPublicComment] = useState('')
  const [privateComment, setPrivateComment] = useState('')

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-primary">#{entry.work_number}</span>
          <span className="font-semibold">{entry.works?.title || '無題'}</span>
          <span className="text-sm text-base-content/70">{entry.users?.name || '応募者'}</span>
          <span className="text-xs text-base-content/60">{entry.school_name || '-'} / {entry.grade || '-'}</span>
          {phase === 'final' ? <span className="badge badge-outline">一次順位参考: {entry.primary_avg_score}</span> : null}
          {phase === 'final' ? <span className="badge badge-outline">最終集計: {entry.final_avg_score}</span> : null}
        </div>
        <p className="text-sm text-base-content/80">{entry.works?.short_description || ''}</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <ScoreSelect label="独創性" value={scoreOriginality} onChange={setScoreOriginality} />
          <ScoreSelect label="技能" value={scoreSkill} onChange={setScoreSkill} />
          <ScoreSelect label="努力" value={scoreEffort} onChange={setScoreEffort} />
          <ScoreSelect label="目標" value={scorePurpose} onChange={setScorePurpose} />
          <label className="form-control">
            <div className="label py-1"><span className="label-text text-xs">その他</span></div>
            <input className="input input-bordered input-sm" value={scoreOther} onChange={(e) => setScoreOther(e.target.value)} />
          </label>
        </div>

        <textarea className="textarea textarea-bordered" placeholder={phase === 'final' ? '公開コメント（必須）' : '公開コメント（任意）'} value={publicComment} onChange={(e) => setPublicComment(e.target.value)} />
        <textarea className="textarea textarea-bordered" placeholder="非公開メモ" value={privateComment} onChange={(e) => setPrivateComment(e.target.value)} />

        <div>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={() => onSave(entry.entry_id, { scoreOriginality, scoreSkill, scoreEffort, scorePurpose, scoreOther, publicComment, privateComment })}
          >
            {saving ? '保存中...' : '採点を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScoreSelect({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <label className="form-control">
      <div className="label py-1"><span className="label-text text-xs">{label}</span></div>
      <select className="select select-bordered select-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </label>
  )
}
