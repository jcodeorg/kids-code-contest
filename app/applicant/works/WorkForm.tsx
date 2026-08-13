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

  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const detailedTextRef = useRef<HTMLTextAreaElement | null>(null)
  const easyMdeRef = useRef<EasyMDE | null>(null)
  const initialDetailedDescriptionRef = useRef(detailedDescription)

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
    if (!detailedDescriptionValue) {
      setStatus('ながい せつめいを入力してください')
      return
    }

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
          <textarea id="short-desc" className="textarea textarea-bordered w-full" placeholder="みじかい せつめい" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required />
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
          <input id="work-url" className="input input-bordered w-full" placeholder="さくひんのURL" value={workUrl} onChange={(e) => setWorkUrl(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="thumbnail-file" className="block text-sm font-medium mb-1">がぞうファイル</label>
          <input id="thumbnail-file" className="file-input file-input-bordered w-full" type="file" accept="image/*" onChange={handleThumbnailChange} />
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
          <input id="video-file" className="file-input file-input-bordered w-full" type="file" accept="video/*" onChange={handleVideoFileChange} />
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
          <select id="video-type" className="select select-bordered w-full" value={videoType} onChange={(e) => setVideoType(e.target.value)}>
            <option value="youtube_url">YouTube URL</option>
            <option value="mp4_file">MP4 ファイル</option>
          </select>
        </div>

        <div>
          <label htmlFor="video-location" className="block text-sm font-medium mb-1">動画URL / 保存先</label>
          <input id="video-location" className="input input-bordered w-full" placeholder="動画URL / 保存先" value={videoLocation} onChange={(e) => setVideoLocation(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? '保存中...' : submitLabel}</button>
          <button type="button" className="btn btn-ghost" onClick={() => onCancel?.()}>{onCancel ? 'キャンセル' : 'もどる'}</button>
        </div>
      </form>

      {status ? <div className="alert alert-info text-sm mt-3">{status}</div> : null}
    </div>
  )
}
