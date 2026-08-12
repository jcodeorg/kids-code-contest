"use client"

import { useEffect, useState } from 'react'

export type WorkFormValues = {
  work_id?: string
  title: string
  category: string
  short_description: string
  detailed_description: string
  work_url: string
  video_type: string
  video_location: string
}

const CATEGORY_OPTIONS = ['scratch', 'microbit', 'web_app', 'python', 'other']

type SubmitResult = { ok: true } | { ok: false; error?: string }

export default function WorkForm({
  initialValues,
  titleText = '作品',
  submitLabel = '保存する',
  onSubmit,
  onCancel,
  onSuccess,
}: {
  initialValues?: Partial<WorkFormValues>
  titleText?: string
  submitLabel?: string
  onSubmit: (v: WorkFormValues) => Promise<SubmitResult>
  onCancel?: () => void
  onSuccess?: () => void
}) {
  const [title, setTitle] = useState(initialValues?.title || '')
  const [category, setCategory] = useState(initialValues?.category || 'scratch')
  const [shortDescription, setShortDescription] = useState(initialValues?.short_description || '')
  const [detailedDescription, setDetailedDescription] = useState(initialValues?.detailed_description || '')
  const [workUrl, setWorkUrl] = useState(initialValues?.work_url || '')
  const [videoType, setVideoType] = useState(initialValues?.video_type || 'youtube_url')
  const [videoLocation, setVideoLocation] = useState(initialValues?.video_location || '')

  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!initialValues) return
    setTitle(initialValues.title || '')
    setCategory(initialValues.category || 'scratch')
    setShortDescription(initialValues.short_description || '')
    setDetailedDescription(initialValues.detailed_description || '')
    setWorkUrl(initialValues.work_url || '')
    setVideoType(initialValues.video_type || 'youtube_url')
    setVideoLocation(initialValues.video_location || '')
  }, [initialValues])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus('保存中...')
    try {
      const values: WorkFormValues = {
        work_id: initialValues?.work_id,
        title,
        category,
        short_description: shortDescription,
        detailed_description: detailedDescription,
        work_url: workUrl,
        video_type: videoType,
        video_location: videoLocation,
      }
      const res = await onSubmit(values)
      if (!res.ok) {
        setStatus(res.error || '保存に失敗しました')
        return
      }
      setStatus('保存しました')
      onSuccess?.()
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">{titleText}</h2>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
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
        <div className="md:col-span-2 flex gap-2">
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? '保存中...' : submitLabel}</button>
          <button type="button" className="btn btn-ghost" onClick={() => onCancel?.()}>{onCancel ? 'キャンセル' : '戻る'}</button>
        </div>
      </form>

      {status ? <div className="alert alert-info text-sm mt-3">{status}</div> : null}
    </div>
  )
}
