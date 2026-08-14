'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Work = { title?: string; short_description?: string; detailed_description?: string; work_url?: string; video_type?: string; video_location?: string; thumbnail_url?: string | null; category?: string }
type Entry = { entry_id: number; work_number: number; works?: Work }

function renderMarkdown(value: string): ReactNode[] {
  return value.split('\n').map((line, index) => {
    if (line.startsWith('## ')) return <h3 key={index} className="mt-4 text-lg font-bold">{line.slice(3)}</h3>
    if (line.startsWith('# ')) return <h2 key={index} className="mt-4 text-xl font-bold">{line.slice(2)}</h2>
    if (line.startsWith('- ')) return <li key={index} className="ml-5 list-disc">{line.slice(2)}</li>
    if (!line.trim()) return <div key={index} className="h-2" />
    return <p key={index} className="leading-relaxed">{line}</p>
  })
}

export default function StaffReviewEntry({ entryId, phase = 'primary' }: { entryId: string; phase?: 'primary' | 'final' }) {
  const router = useRouter()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [scoreOriginality, setScoreOriginality] = useState('3')
  const [scoreSkill, setScoreSkill] = useState('3')
  const [scoreEffort, setScoreEffort] = useState('3')
  const [scorePurpose, setScorePurpose] = useState('3')
  const [scoreOther, setScoreOther] = useState('3.0')
  const [publicComment, setPublicComment] = useState('')
  const [privateComment, setPrivateComment] = useState('')
  const [hasSavedEvaluation, setHasSavedEvaluation] = useState(false)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`/api/entries?entry_id=${entryId}`, { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.entries?.[0]) {
        setStatus(data?.error || '作品を取得できませんでした')
        return
      }
      setEntry(data.entries[0])

      const evaluationRes = await fetch(`/api/evaluations?entry_id=${entryId}&phase=${phase}&mine=1`, { headers, cache: 'no-store' })
      const evaluationData = await evaluationRes.json()
      const evaluation = evaluationData.evaluations?.[0]
      if (evaluationRes.ok && evaluation) {
        setHasSavedEvaluation(true)
        setScoreOriginality(String(evaluation.score_originality ?? 3))
        setScoreSkill(String(evaluation.score_skill ?? 3))
        setScoreEffort(String(evaluation.score_effort ?? 3))
        setScorePurpose(String(evaluation.score_purpose ?? 3))
        setScoreOther(String(evaluation.score_other ?? 3.0))
        setPublicComment(evaluation.public_comment || '')
        setPrivateComment(evaluation.private_comment || '')
      }
    })()
  }, [entryId, phase])

  async function save() {
    setSaving(true)
    setStatus('保存中...')
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          entry_id: Number(entryId),
          phase,
          score_originality: Number(scoreOriginality),
          score_skill: Number(scoreSkill),
          score_effort: Number(scoreEffort),
          score_purpose: Number(scorePurpose),
          score_other: Number(scoreOther),
          public_comment: publicComment,
          private_comment: privateComment,
          status: 'completed',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(`保存に失敗しました: ${data?.error || res.status}`)
        return
      }
      router.push(phase === 'final' ? '/judge' : '/staff')
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvaluation() {
    const confirmed = window.confirm('自分の採点とコメントを削除します。よろしいですか？')
    if (!confirmed) return

    setSaving(true)
    setStatus('採点を削除中...')
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const res = await fetch('/api/evaluations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ entry_id: Number(entryId), phase }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(`削除に失敗しました: ${data?.error || res.status}`)
        return
      }
      setScoreOriginality('3')
      setScoreSkill('3')
      setScoreEffort('3')
      setScorePurpose('3')
      setScoreOther('3.0')
      setPublicComment('')
      setPrivateComment('')
      setHasSavedEvaluation(false)
      router.push(phase === 'final' ? '/judge' : '/staff')
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const work = entry?.works
  return (
    <div className="w-full px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">審査</h1>
          <Link className="btn btn-ghost" href={phase === 'final' ? '/judge' : '/staff'}>一覧へ戻る</Link>
        </div>
        {status && !entry ? <div className="alert alert-error">{status}</div> : null}
        {work ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <article className="card bg-base-100 border border-base-200 shadow-md">
              <div className="card-body gap-5">
                <h2 className="text-3xl font-bold">{work.title || '無題'}</h2>
                {work.thumbnail_url ? <Image src={work.thumbnail_url} alt="作品サムネイル" width={1200} height={800} unoptimized loading="eager" className="max-h-80 w-full rounded-box bg-base-200 object-contain" /> : null}
                {work.video_location ? (work.video_type === 'mp4_file' ? <video src={work.video_location} controls className="max-h-96 w-full rounded-box bg-black" /> : <a className="link link-primary break-all" href={work.video_location} target="_blank" rel="noreferrer">動画を見る</a>) : null}
                {work.short_description ? <p className="text-xl font-semibold">{work.short_description}</p> : null}
                {work.work_url ? <a className="link link-primary break-all" href={work.work_url} target="_blank" rel="noreferrer">{work.work_url}</a> : null}
                <div className="prose max-w-none">{renderMarkdown(work.detailed_description || '説明はありません。')}</div>
              </div>
            </article>

            <aside className="card h-fit bg-base-100 border border-base-200 shadow-md">
              <div className="card-body gap-4">
                <h2 className="card-title">ルーブリック採点</h2>
                <ScoreSelect label="独創性" value={scoreOriginality} onChange={setScoreOriginality} />
                <ScoreSelect label="技能" value={scoreSkill} onChange={setScoreSkill} />
                <ScoreSelect label="努力" value={scoreEffort} onChange={setScoreEffort} />
                <ScoreSelect label="目標" value={scorePurpose} onChange={setScorePurpose} />
                <label className="form-control">
                  <span className="label-text">その他（1.0〜5.0）</span>
                  <input className="input input-bordered" type="number" min="1" max="5" step="0.1" value={scoreOther} onChange={(e) => setScoreOther(e.target.value)} />
                </label>
                <h2 className="card-title mt-2">コメント</h2>
                <label className="form-control">
                  <span className="label-text">公開コメント（応援メッセージ）</span>
                  <textarea className="textarea textarea-bordered min-h-32" value={publicComment} onChange={(e) => setPublicComment(e.target.value)} placeholder="応募者への応援メッセージ" />
                </label>
                <label className="form-control">
                  <span className="label-text">非公開コメント（評価メモ）</span>
                  <textarea className="textarea textarea-bordered min-h-24" value={privateComment} onChange={(e) => setPrivateComment(e.target.value)} placeholder="審査用のメモ" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
                  {hasSavedEvaluation ? <button className="btn btn-outline btn-error" type="button" onClick={() => void deleteEvaluation()} disabled={saving}>自分の採点を削除</button> : null}
                </div>
                {status ? <div className="alert alert-info text-sm">{status}</div> : null}
              </div>
            </aside>
          </div>
        ) : !status ? <div className="alert alert-info">読み込み中...</div> : null}
      </div>
    </div>
  )
}

function ScoreSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-control">
      <span className="label-text">{label}（1〜5）</span>
      <select className="select select-bordered" value={value} onChange={(e) => onChange(e.target.value)}>
        {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
      </select>
    </label>
  )
}
