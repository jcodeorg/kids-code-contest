"use client"

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export type WorkFormValues = {
  work_id?: string
  title: string
  category: string
  short_description: string
  detailed_description: string
  work_url: string
  video_type: string
  video_location: string
  thumbnail_url?: string
  video_file_url?: string
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
  const [thumbnailUrl, setThumbnailUrl] = useState(initialValues?.thumbnail_url || '')
  const [videoFileUrl, setVideoFileUrl] = useState(initialValues?.video_file_url || '')

  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  function looksLikeMp4Url(value: string) {
    const v = value.trim().toLowerCase()
    if (!v) return false
    return v.endsWith('.mp4') || v.includes('.mp4?') || v.includes('/uploads/video/')
  }

  async function buildAuthHeaders() {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token || null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return headers
  }

  useEffect(() => {
    if (!initialValues) return
    setTitle(initialValues.title || '')
    setCategory(initialValues.category || 'scratch')
    setShortDescription(initialValues.short_description || '')
    setDetailedDescription(initialValues.detailed_description || '')
    setWorkUrl(initialValues.work_url || '')
    setVideoType(initialValues.video_type || 'youtube_url')
    setVideoLocation(initialValues.video_location || '')
    setThumbnailUrl(initialValues.thumbnail_url || '')
    const fallbackMp4Url = initialValues.video_location || ''
    setVideoFileUrl(initialValues.video_file_url || (looksLikeMp4Url(fallbackMp4Url) ? fallbackMp4Url : ''))
  }, [initialValues])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const resolvedVideoLocation =
      videoType === 'mp4_file' ? (videoFileUrl || videoLocation).trim() : videoLocation.trim()
    if (!resolvedVideoLocation) {
      setStatus('動画URLまたは動画ファイルを設定してください')
      return
    }

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
        video_location: resolvedVideoLocation,
        thumbnail_url: thumbnailUrl,
        video_file_url: videoFileUrl,
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

  async function uploadFile(file: File, kind: 'thumbnail' | 'video') {
    if (!file) return null
    try {
      if (kind === 'thumbnail') setUploadingThumbnail(true)
      else setUploadingVideo(true)

      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)

      const headers = await buildAuthHeaders()
      delete headers['Content-Type']

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers,
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'upload failed')
      return { url: data.url as string, key: (data.key as string | undefined) || '' }
    } finally {
      if (kind === 'thumbnail') setUploadingThumbnail(false)
      else setUploadingVideo(false)
    }
  }

  async function deleteUploadedByUrl(url: string) {
    if (!url) return
    const headers = await buildAuthHeaders()
    const res = await fetch('/api/uploads', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'delete failed')
  }

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    void (async () => {
      try {
        const oldUrl = thumbnailUrl
        const uploaded = await uploadFile(f, 'thumbnail')
        if (uploaded?.url) {
          setThumbnailUrl(uploaded.url)
          if (oldUrl && oldUrl !== uploaded.url) {
            void deleteUploadedByUrl(oldUrl)
          }
        }
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : 'サムネイルのアップロードに失敗しました')
      }
    })()
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    void (async () => {
      try {
        const oldUrl = videoFileUrl
        const uploaded = await uploadFile(f, 'video')
        if (uploaded?.url) {
          setVideoFileUrl(uploaded.url)
          setVideoType('mp4_file')
          setVideoLocation(uploaded.url)
          if (oldUrl && oldUrl !== uploaded.url) {
            void deleteUploadedByUrl(oldUrl)
          }
        }
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : '動画のアップロードに失敗しました')
      }
    })()
  }

  function handleDeleteThumbnail() {
    if (!thumbnailUrl) return
    void (async () => {
      try {
        await deleteUploadedByUrl(thumbnailUrl)
      } catch {
        // DB保存前のURLなど削除不可の可能性があるため、UI上の参照は消す。
      }
      setThumbnailUrl('')
      setStatus('サムネイルを削除しました')
    })()
  }

  function handleDeleteVideo() {
    if (!videoFileUrl) return
    void (async () => {
      try {
        await deleteUploadedByUrl(videoFileUrl)
      } catch {
        // DB保存前のURLなど削除不可の可能性があるため、UI上の参照は消す。
      }
      setVideoFileUrl('')
      if (videoType === 'mp4_file') setVideoLocation('')
      setStatus('動画を削除しました')
    })()
  }

  const videoPreviewUrl = videoFileUrl || (videoType === 'mp4_file' ? videoLocation : '')

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">{titleText}</h2>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title-input" className="block text-sm font-medium mb-1">作品タイトル</label>
          <input id="title-input" className="input input-bordered" placeholder="作品タイトル" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="category-select" className="block text-sm font-medium mb-1">カテゴリ</label>
          <select id="category-select" className="select select-bordered" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="short-desc" className="block text-sm font-medium mb-1">短い説明</label>
          <input id="short-desc" className="input input-bordered w-full" placeholder="短い説明" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="detailed-desc" className="block text-sm font-medium mb-1">詳細説明</label>
          <textarea id="detailed-desc" className="textarea textarea-bordered w-full" placeholder="詳細説明" value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="work-url" className="block text-sm font-medium mb-1">作品URL</label>
          <input id="work-url" className="input input-bordered" placeholder="作品URL" value={workUrl} onChange={(e) => setWorkUrl(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="video-type" className="block text-sm font-medium mb-1">動画タイプ</label>
          <select id="video-type" className="select select-bordered" value={videoType} onChange={(e) => setVideoType(e.target.value)}>
            <option value="youtube_url">YouTube URL</option>
            <option value="mp4_file">MP4 ファイル</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="video-location" className="block text-sm font-medium mb-1">動画URL / 保存先</label>
          <input id="video-location" className="input input-bordered w-full" placeholder="動画URL / 保存先" value={videoLocation} onChange={(e) => setVideoLocation(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="thumbnail-file" className="block text-sm font-medium mb-1">サムネイル画像</label>
          <input id="thumbnail-file" type="file" accept="image/*" onChange={handleThumbnailChange} />
          {uploadingThumbnail ? <div className="text-sm text-gray-500">アップロード中...</div> : null}
          {thumbnailUrl ? (
            <div className="mt-2 flex flex-col gap-2">
              <img src={thumbnailUrl} alt="thumbnail" className="w-full h-auto max-h-40 object-contain" />
              <div>
                <button type="button" className="btn btn-sm btn-outline btn-error" onClick={handleDeleteThumbnail}>画像を削除</button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <label htmlFor="video-file" className="block text-sm font-medium mb-1">動画ファイル (mp4)</label>
          <input id="video-file" type="file" accept="video/*" onChange={handleVideoFileChange} />
          {uploadingVideo ? <div className="text-sm text-gray-500">アップロード中...</div> : null}
          {videoPreviewUrl ? (
            <div className="mt-2 flex flex-col gap-2">
              <video src={videoPreviewUrl} controls className="w-full h-auto max-h-60 object-contain" />
              <div>
                <button type="button" className="btn btn-sm btn-outline btn-error" onClick={handleDeleteVideo}>動画を削除</button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? '保存中...' : submitLabel}</button>
          <button type="button" className="btn btn-ghost" onClick={() => onCancel?.()}>{onCancel ? 'キャンセル' : '戻る'}</button>
        </div>
      </form>

      {status ? <div className="alert alert-info text-sm mt-3">{status}</div> : null}
    </div>
  )
}
