"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../../../lib/supabase/client'

type Work = {
  work_id: string
  title: string
  category: string
  short_description: string
  detailed_description: string
  work_url: string
  video_type: string
  video_location: string
  thumbnail_url: string
}

function categoryLabel(category: string) {
  if (category === 'scratch') return 'スクラッチ'
  if (category === 'microbit') return 'マイクロビット'
  if (category === 'python') return 'Python'
  return 'その他'
}

function renderMarkdown(markdown: string): ReactNode[] {
  return markdown.split('\n').map((line, index) => {
    const key = `${index}-${line}`
    if (line.startsWith('### ')) return <h3 key={key} className="text-lg font-semibold mt-4">{line.slice(4)}</h3>
    if (line.startsWith('## ')) return <h2 key={key} className="text-xl font-bold mt-5">{line.slice(3)}</h2>
    if (line.startsWith('# ')) return <h1 key={key} className="text-2xl font-bold mt-5">{line.slice(2)}</h1>
    if (line.startsWith('- ')) return <li key={key} className="ml-5 list-disc">{line.slice(2)}</li>
    if (line.startsWith('> ')) return <blockquote key={key} className="border-l-4 border-primary pl-3 italic text-base-content/70">{line.slice(2)}</blockquote>
    if (line.startsWith('```')) return <div key={key} className="h-2" />
    if (!line.trim()) return <div key={key} className="h-3" />

    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIndex}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`')) return <code key={partIndex} className="rounded bg-base-200 px-1">{part.slice(1, -1)}</code>
      return part
    })
    return <p key={key} className="leading-relaxed">{parts}</p>
  })
}

export default function WorkPreviewPage() {
  const params = useParams() as { workId?: string }
  const workId = params.workId || ''
  const [work, setWork] = useState<Work | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!workId) return
    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          const session = await supabase.auth.getSession()
          const headers: Record<string, string> = {}
          const token = session.data.session?.access_token
          if (token) headers.Authorization = `Bearer ${token}`
          const res = await fetch('/api/works', { headers })
          const data = await res.json()
          if (!res.ok) {
            setStatus(data?.error || '作品取得に失敗しました')
            return
          }
          const target = (data.works || []).find((item: Work) => item.work_id === workId)
          if (!target) {
            setStatus('作品が見つかりません')
            return
          }
          setWork(target)
        } catch (err: unknown) {
          setStatus(err instanceof Error ? err.message : '作品取得に失敗しました')
        } finally {
          setLoading(false)
        }
      })()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [workId])

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-3xl mx-auto card bg-base-100 border border-base-200 shadow-md">
        <div className="card-body gap-5">
          {loading ? <div className="alert alert-info">読み込み中...</div> : null}
          {status ? <div className="alert alert-error">{status}</div> : null}

          {work ? (
            <article className="space-y-5">
              <div className="flex justify-end">
                <Link className="btn btn-ghost btn-sm" href="/applicant">もどる</Link>
              </div>
              <h2 className="text-3xl font-bold">{work.title}</h2>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">カテゴリー</h3>
                <span className="badge badge-outline">{categoryLabel(work.category)}</span>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">サムネイル画像</h3>
                {work.thumbnail_url ? (
                  <Image src={work.thumbnail_url} alt="作品のサムネイル" width={1200} height={800} unoptimized className="w-full max-h-96 object-contain rounded-box bg-base-200" />
                ) : <p className="text-base-content/60">画像はありません。</p>}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">動画</h3>
                {work.video_location ? (
                  work.video_type === 'mp4_file' ? (
                    <video src={work.video_location} controls className="w-full max-h-96 rounded-box bg-black" />
                  ) : (
                    <a className="link link-primary break-all" href={work.video_location} target="_blank" rel="noreferrer">動画を見る</a>
                  )
                ) : <p className="text-base-content/60">動画はありません。</p>}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">短い説明</h3>
                <p className="text-xl font-semibold leading-relaxed text-base-content">{work.short_description || '説明はまだ入力されていません。'}</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">作品URL</h3>
                {work.work_url ? (
                  <a className="link link-primary break-all" href={work.work_url} target="_blank" rel="noreferrer">{work.work_url}</a>
                ) : <p className="text-base-content/60">URLはありません。</p>}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium text-base-content/55">Markdown の長い説明</h3>
                <div className="prose max-w-none">
                  {renderMarkdown(work.detailed_description || '説明はまだ入力されていません。')}
                </div>
              </section>
            </article>
          ) : null}
        </div>
      </div>
    </div>
  )
}
