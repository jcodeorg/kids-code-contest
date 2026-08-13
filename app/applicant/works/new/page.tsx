"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase/client'
import WorkForm, { WorkFormValues } from '../WorkForm'

export default function NewWorkPage() {
  const router = useRouter()

  async function buildAuthHeaders() {
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token || null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return headers
  }

  async function handleSubmit(values: WorkFormValues) {
    const headers = await buildAuthHeaders()
    const contestRes = await fetch('/api/contests')
    const contestData = contestRes.ok ? await contestRes.json() : null
    const contestId = contestData?.active_contest?.contest_id ?? contestData?.contests?.[0]?.contest_id ?? null

    const res = await fetch('/api/works', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contest_id: contestId,
        title: values.title,
        category: values.category,
        short_description: values.short_description,
        detailed_description: values.detailed_description,
        work_url: values.work_url,
        video_type: values.video_type,
        video_location: values.video_location || values.video_file_url || '',
        thumbnail_url: values.thumbnail_url || '',
        has_hardware: false,
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
            <h1 className="card-title text-2xl">作品を追加</h1>
            <Link className="btn btn-ghost" href="/applicant">戻る</Link>
          </div>

          <WorkForm
            submitLabel="保存する"
            onSubmit={handleSubmit}
            onSuccess={() => router.push('/applicant')}
            onCancel={() => router.push('/applicant')}
          />
        </div>
      </div>
    </div>
  )
}
