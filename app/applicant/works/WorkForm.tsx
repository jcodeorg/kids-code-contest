"use client"

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import type EasyMDE from 'easymde'
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

const CATEGORY_OPTIONS = [
  { value: 'scratch', label: 'スクラッチ' },
  { value: 'microbit', label: 'マイクロビット' },
  { value: 'python', label: 'Python' },
  { value: 'other', label: 'その他' },
] as const

const DEFAULT_DETAILED_DESCRIPTION = `## どんな さくひんか


## つくりかた


## くふうしたところ


## てつだってもらった ところ`

type SubmitResult = { ok: true } | { ok: false; error?: string }

export default function WorkForm({
  initialValues,
  titleText = 'コンテスト応募フォーム',
  submitLabel = 'とうろく',
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
  function looksLikeMp4Url(value: string) {
    const v = value.trim().toLowerCase()
    if (!v) return false
    return v.endsWith('.mp4') || v.includes('.mp4?') || v.includes('/uploads/video/')
  }

  const getInitialFormState = (values?: Partial<WorkFormValues>) => ({
    title: values?.title || '',
    category: values?.category || 'scratch',
    shortDescription: values?.short_description || '',
    detailedDescription:
      values?.detailed_description || (values?.work_id ? '' : DEFAULT_DETAILED_DESCRIPTION),
    workUrl: values?.work_url || '',
    videoType: values?.video_type || 'youtube_url',
    videoLocation: values?.video_location || '',
    thumbnailUrl: values?.thumbnail_url || '',
    videoFileUrl: values?.video_file_url || '',
  })

  const [title, setTitle] = useState(() => getInitialFormState(initialValues).title)
  const [category, setCategory] = useState(() => getInitialFormState(initialValues).category)
  const [shortDescription, setShortDescription] = useState(() => getInitialFormState(initialValues).shortDescription)
  const [detailedDescription, setDetailedDescription] = useState(() => getInitialFormState(initialValues).detailedDescription)
  const [workUrl, setWorkUrl] = useState(() => getInitialFormState(initialValues).workUrl)
  const [videoType, setVideoType] = useState(() => getInitialFormState(initialValues).videoType)
  const [videoLocation, setVideoLocation] = useState(() => getInitialFormState(initialValues).videoLocation)
  const [thumbnailUrl, setThumbnailUrl] = useState(() => getInitialFormState(initialValues).thumbnailUrl)
  const [videoFileUrl, setVideoFileUrl] = useState(() => {
    const state = getInitialFormState(initialValues)
    const fallbackMp4Url = state.videoLocation || ''
    return state.videoFileUrl || (looksLikeMp4Url(fallbackMp4Url) ? fallbackMp4Url : '')
  })

  const resetFormFromValues = useCallback((values?: Partial<WorkFormValues>) => {
    const next = getInitialFormState(values)
    const fallbackMp4Url = next.videoLocation || ''

    setTitle(next.title)
    setCategory(next.category)
    setShortDescription(next.shortDescription)
    setDetailedDescription(next.detailedDescription)
    setWorkUrl(next.workUrl)
    setVideoType(next.videoType)
    setVideoLocation(next.videoLocation)
    setThumbnailUrl(next.thumbnailUrl)
    setVideoFileUrl(next.videoFileUrl || (looksLikeMp4Url(fallbackMp4Url) ? fallbackMp4Url : ''))
  }, [])

  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [thumbnailFileName, setThumbnailFileName] = useState('')
  const [videoFileName, setVideoFileName] = useState('')

  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const detailedTextRef = useRef<HTMLTextAreaElement | null>(null)
  const easyMdeRef = useRef<EasyMDE | null>(null)
  const initialDetailedDescriptionRef = useRef(detailedDescription)
  const pendingUploadedUrlsRef = useRef(new Set<string>())
  const discardedUploadedUrlsRef = useRef(new Set<string>())
  const pendingDeletedUrlsRef = useRef(new Set<string>())

  async function buildAuthHeaders() {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token || null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return headers
  }

  useEffect(() => {
    if (!initialValues) return

    const timeoutId = window.setTimeout(() => {
      resetFormFromValues(initialValues)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [initialValues, resetFormFromValues])

  useEffect(() => {
    if (typeof window === 'undefined' || !detailedTextRef.current || easyMdeRef.current) return

    let isActive = true

    void (async () => {
      await import('easymde/dist/easymde.min.css')
      const imported = await import('easymde')
      const EasyMDEConstructor = (imported.default ?? imported) as typeof EasyMDE

      if (!isActive || typeof window === 'undefined') return

      const editor = new EasyMDEConstructor({
        element: detailedTextRef.current!,
        initialValue: initialDetailedDescriptionRef.current,
        spellChecker: false,
        status: false,
        toolbar: ['bold', 'italic', 'heading', 'unordered-list', 'ordered-list', 'quote', 'code', 'link'],
        hideIcons: ['guide'],
        autoDownloadFontAwesome: true,
      })

      easyMdeRef.current = editor
      editor.codemirror.on('change', () => setDetailedDescription(editor.value()))
    })()

    return () => {
      isActive = false
      easyMdeRef.current?.toTextArea()
      easyMdeRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!easyMdeRef.current) return
    const nextValue = detailedDescription || ''
    if (easyMdeRef.current.value() !== nextValue) {
      easyMdeRef.current.value(nextValue)
    }
  }, [detailedDescription])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const detailedDescriptionValue = (easyMdeRef.current?.value() || detailedDescription).trim()
    const resolvedVideoLocation =
      videoType === 'mp4_file' ? (videoFileUrl || videoLocation).trim() : videoLocation.trim()

    setSaving(true)
    setStatus('保存中...')
    try {
      const values: WorkFormValues = {
        work_id: initialValues?.work_id,
        title,
        category,
        short_description: shortDescription,
        detailed_description: detailedDescriptionValue,
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
      await finalizePendingFileChanges()
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

  function trackUpload(url: string, previousUrl: string) {
    pendingUploadedUrlsRef.current.add(url)
    if (previousUrl && previousUrl !== url) {
      if (pendingUploadedUrlsRef.current.has(previousUrl)) {
        discardedUploadedUrlsRef.current.add(previousUrl)
      } else {
        pendingDeletedUrlsRef.current.add(previousUrl)
      }
    }
  }

  function trackDeletion(url: string) {
    if (!url) return
    if (pendingUploadedUrlsRef.current.has(url)) {
      discardedUploadedUrlsRef.current.add(url)
      return
    }
    pendingDeletedUrlsRef.current.add(url)
  }

  async function finalizePendingFileChanges() {
    const urlsToDelete = Array.from(new Set([
      ...pendingDeletedUrlsRef.current,
      ...discardedUploadedUrlsRef.current,
    ]))
    await Promise.allSettled(urlsToDelete.map((url) => deleteUploadedByUrl(url)))
    pendingUploadedUrlsRef.current.clear()
    discardedUploadedUrlsRef.current.clear()
    pendingDeletedUrlsRef.current.clear()
  }

  async function discardPendingFileChanges() {
    const urlsToDelete = Array.from(new Set([
      ...pendingUploadedUrlsRef.current,
      ...discardedUploadedUrlsRef.current,
    ]))
    await Promise.allSettled(urlsToDelete.map((url) => deleteUploadedByUrl(url)))
    pendingUploadedUrlsRef.current.clear()
    discardedUploadedUrlsRef.current.clear()
    pendingDeletedUrlsRef.current.clear()
  }

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setThumbnailFileName(f.name)
    void (async () => {
      try {
        const oldUrl = thumbnailUrl
        const uploaded = await uploadFile(f, 'thumbnail')
        if (uploaded?.url) {
          setThumbnailUrl(uploaded.url)
          trackUpload(uploaded.url, oldUrl)
        }
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : 'サムネイルのアップロードに失敗しました')
      }
    })()
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setVideoFileName(f.name)
    void (async () => {
      try {
        const oldUrl = videoFileUrl
        const uploaded = await uploadFile(f, 'video')
        if (uploaded?.url) {
          setVideoFileUrl(uploaded.url)
          setVideoType('mp4_file')
          setVideoLocation(uploaded.url)
          trackUpload(uploaded.url, oldUrl)
        }
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : '動画のアップロードに失敗しました')
      }
    })()
  }

  function handleDeleteThumbnail() {
    if (!thumbnailUrl) return
    trackDeletion(thumbnailUrl)
    setThumbnailUrl('')
    setThumbnailFileName('')
    setStatus('サムネイルを削除しました')
  }

  function handleDeleteVideo() {
    if (!videoFileUrl) return
    trackDeletion(videoFileUrl)
    setVideoFileUrl('')
    setVideoFileName('')
    setVideoType('youtube_url')
    setVideoLocation('')
    setStatus('動画を削除しました')
  }

  async function handleCancel() {
    await discardPendingFileChanges()
    onCancel?.()
  }

  const videoPreviewUrl = videoFileUrl || (videoType === 'mp4_file' ? videoLocation : '')
  const hasUploadedVideo = Boolean(videoFileUrl.trim())

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">{titleText}</h2>
      </div>

      <form className="grid grid-cols-1 gap-3" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="category-select" className="block text-sm font-medium mb-1">カテゴリー</label>
          <select id="category-select" className="select select-bordered w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="title-input" className="block text-sm font-medium mb-1">さくひんの なまえ</label>
          <input id="title-input" className="input input-bordered w-full" placeholder="さくひんの なまえ" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="short-desc" className="block text-sm font-medium mb-1">みじかい せつめい</label>
          <textarea id="short-desc" className="textarea textarea-bordered w-full" placeholder="みじかい せつめい" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </div>

        <div>
          <label htmlFor="detailed-desc" className="block text-sm font-medium mb-1">ながい せつめい（Markdown）</label>
          <textarea
            ref={detailedTextRef}
            id="detailed-desc"
            className="easy-mde-editor w-full min-h-40"
            placeholder="# 見出し\n- 箇条書き\n- **太字**\n- `コード`"
          />
          <div className="mt-1 text-xs text-gray-500"># 見出し / - 箇条書き / **太字** / `コード` を使えます</div>
        </div>

        <div>
          <label htmlFor="work-url" className="block text-sm font-medium mb-1">さくひんのURL</label>
          <input id="work-url" className="input input-bordered w-full" placeholder="さくひんのURL" value={workUrl} onChange={(e) => setWorkUrl(e.target.value)} />
        </div>

        <div>
          <label htmlFor="thumbnail-file" className="block text-sm font-medium mb-1">がぞうファイル</label>
          <div className="flex flex-wrap items-center gap-3">
            <input id="thumbnail-file" className="sr-only" type="file" accept="image/*" onChange={handleThumbnailChange} />
            <label htmlFor="thumbnail-file" className="btn btn-primary cursor-pointer">ファイルを選択</label>
            <span className="text-sm text-base-content/70">
              {thumbnailFileName || (thumbnailUrl ? 'アップロード済み' : 'ファイルが選択されていません')}
            </span>
          </div>
          {uploadingThumbnail ? <div className="text-sm text-gray-500">アップロード中...</div> : null}
          {thumbnailUrl ? (
            <div className="mt-2 flex flex-col gap-2">
              <Image
                src={thumbnailUrl}
                alt="thumbnail"
                width={1200}
                height={800}
                unoptimized
                className="w-full h-auto max-h-40 object-contain"
              />
              <div>
                <button type="button" className="btn btn-sm btn-outline btn-error" onClick={handleDeleteThumbnail}>画像を削除</button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="video-file" className="block text-sm font-medium mb-1">どうが ファイル (mp4)</label>
          <div className="flex flex-wrap items-center gap-3">
            <input id="video-file" className="sr-only" type="file" accept="video/*" onChange={handleVideoFileChange} />
            <label htmlFor="video-file" className="btn btn-primary cursor-pointer">ファイルを選択</label>
            <span className="text-sm text-base-content/70">
              {videoFileName || (videoFileUrl ? 'アップロード済み' : 'ファイルが選択されていません')}
            </span>
          </div>
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

        <div>
          <label htmlFor="video-type" className="block text-sm font-medium mb-1">動画タイプ</label>
          <select
            id="video-type"
            className="select select-bordered w-full"
            value={videoType}
            onChange={(e) => setVideoType(e.target.value)}
            disabled={hasUploadedVideo}
          >
            <option value="youtube_url">YouTube URL</option>
            <option value="mp4_file">MP4 ファイル</option>
          </select>
          {hasUploadedVideo ? <div className="mt-1 text-xs text-gray-500">MP4動画を削除すると変更できます。</div> : null}
        </div>

        <div>
          <label htmlFor="video-location" className="block text-sm font-medium mb-1">動画URL / 保存先</label>
          <input
            id="video-location"
            className="input input-bordered w-full"
            placeholder="動画URL / 保存先"
            value={videoLocation}
            onChange={(e) => {
              setVideoLocation(e.target.value)
              setVideoType('youtube_url')
            }}
            disabled={hasUploadedVideo}
          />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? '保存中...' : submitLabel}</button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleCancel()}>{onCancel ? 'キャンセル' : 'もどる'}</button>
        </div>
      </form>

      {status ? <div className="alert alert-info text-sm mt-3">{status}</div> : null}
    </div>
  )
}
