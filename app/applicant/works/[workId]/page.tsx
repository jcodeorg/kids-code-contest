"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase/client'
import WorkForm, { WorkFormValues } from '../WorkForm'

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

export default function EditWorkPage() {
  const params = useParams() as { workId?: string }
  const workId = params.workId || ''
  const router = useRouter()

  const [initialValues, setInitialValues] = useState<Partial<WorkFormValues> | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  async function buildAuthHeaders(withJson = false) {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token || null
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return headers
  }

  useEffect(() => {
    if (!workId) return
    const timerId = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const headers = await buildAuthHeaders(false)
          const res = await fetch('/api/works', { headers })
          const data = await res.json()
          if (!res.ok) {
            setStatus(data?.error || '作品取得に失敗しました')
            return
          }

          const target = (data.works || []).find((w: Work) => w.work_id === workId)
          if (!target) {
            setStatus('作品が見つかりません')
            return
          }

          setInitialValues({
            work_id: target.work_id,
            title: target.title || '',
            category: target.category || 'scratch',
            short_description: target.short_description || '',
            detailed_description: target.detailed_description || '',
            work_url: target.work_url || '',
            video_type: target.video_type || 'youtube_url',
            video_location: target.video_location || '',
            thumbnail_url: target.thumbnail_url || '',
            video_file_url: target.video_type === 'mp4_file' ? (target.video_location || '') : '',
          })
        } catch (err: unknown) {
          setStatus(err instanceof Error ? err.message : '作品取得に失敗しました')
        } finally {
          setLoading(false)
        }
      })()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [workId])

  async function handleSubmit(values: WorkFormValues) {
    if (!workId) return { ok: false as const, error: 'invalid work id' }
    const headers = await buildAuthHeaders(true)
    const res = await fetch('/api/works', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        work_id: workId,
        title: values.title,
        category: values.category,
        short_description: values.short_description,
        detailed_description: values.detailed_description,
        work_url: values.work_url,
        video_type: values.video_type,
        video_location: values.video_location || values.video_file_url || '',
        thumbnail_url: values.thumbnail_url || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false as const, error: data?.error || String(res.status) }
    return { ok: true as const }
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-3xl mx-auto card bg-base-100 border border-base-200 shadow-md">
        <div className="card-body gap-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="card-title text-2xl">さくひんを へんしゅう</h1>
            <Link className="btn btn-ghost" href="/applicant">もどる</Link>
          </div>

          {loading ? (
            <div className="alert alert-info">読み込み中...</div>
          ) : (
            <WorkForm
              initialValues={initialValues}
              submitLabel="ほぞん する"
              onSubmit={handleSubmit}
              onSuccess={() => router.push('/applicant')}
              onCancel={() => router.push('/applicant')}
            />
          )}

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
    </div>
  )
}
