import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Cat, Code2, Cpu, Ellipsis } from 'lucide-react'
import { resolveActiveRoleForIdentity } from '../../../../../lib/auth/role-security'
import { createSupabaseServerClient } from '../../../../../lib/supabase/server-client'
import { supabaseAdmin } from '../../../../../lib/supabase/server'

type Work = {
  work_id: string
  title: string
  category: string
  thumbnail_url: string | null
}

function categoryLabel(category: string) {
  if (category === 'scratch') return 'スクラッチ'
  if (category === 'microbit') return 'マイクロビット'
  if (category === 'python') return 'Python'
  if (category === 'web_app') return 'Webアプリ'
  return 'その他'
}

function CategoryIcon({ category }: { category: string }) {
  const iconProps = { size: 20, strokeWidth: 2, 'aria-hidden': true as const }
  if (category === 'scratch') return <Cat {...iconProps} />
  if (category === 'microbit') return <Cpu {...iconProps} />
  if (category === 'python' || category === 'web_app') return <Code2 {...iconProps} />
  return <Ellipsis {...iconProps} />
}

export default async function ApplicantWorksPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ contest_id?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  if (!user?.email) redirect('/auth/signin')

  const resolved = await resolveActiveRoleForIdentity({ userId: user.id, email: user.email })
  if (!resolved.ok || !['contest_admin', 'admin'].includes(resolved.currentRoleId)) {
    redirect('/auth/signin')
  }

  const [{ userId }, query] = await Promise.all([params, searchParams])
  const parsedContestId = Number(query.contest_id)
  const contestId = Number.isInteger(parsedContestId) && parsedContestId > 0 ? parsedContestId : null

  const [applicantResult, worksResult] = await Promise.all([
    supabaseAdmin.from('users').select('name').eq('user_id', userId).maybeSingle(),
    supabaseAdmin
      .from('works')
      .select('work_id,title,category,thumbnail_url')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ])

  if (applicantResult.error || !applicantResult.data) notFound()
  if (worksResult.error) throw worksResult.error

  const { data: entries, error: entryError } = contestId
    ? await supabaseAdmin
      .from('contest_entries')
      .select('work_id,work_number')
      .eq('user_id', userId)
      .eq('contest_id', contestId)
      .limit(1)
    : { data: [], error: null }

  if (entryError) throw entryError
  const entry = entries?.[0]
  const works = (worksResult.data || []) as Work[]

  return (
    <div className="w-full px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-base-content/60">応募者: {applicantResult.data.name || '-'}</p>
            <h1 className="text-2xl font-bold">さくひん いちらん</h1>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/contest_admin/entries">応募一覧へ戻る</Link>
        </div>

        <section className="card border border-base-200 bg-base-100 shadow-md">
          <div className="card-body gap-4">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr><th>作品</th><th>ステータス</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {works.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-base-content/60">作品はありません</td></tr>
                  ) : works.map((work) => {
                    const isSubmitted = !!entry?.work_id && entry.work_id === work.work_id
                    const previewParams = new URLSearchParams({ owner_id: userId })
                    if (contestId) previewParams.set('contest_id', String(contestId))

                    return (
                      <tr key={work.work_id}>
                        <td>
                          <div className="flex min-w-56 items-center gap-3">
                            {work.thumbnail_url ? (
                              <Image src={work.thumbnail_url} alt="" width={64} height={48} unoptimized className="h-12 w-16 shrink-0 rounded object-cover" />
                            ) : (
                              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-base-200 text-xs text-base-content/50">画像なし</div>
                            )}
                            <span className="inline-flex shrink-0 items-center justify-center rounded-box bg-base-200 p-2" title={categoryLabel(work.category)} aria-label={categoryLabel(work.category)}>
                              <CategoryIcon category={work.category} />
                            </span>
                            <span className="font-medium">{work.title}</span>
                          </div>
                        </td>
                        <td>{isSubmitted ? `応募した (#${entry?.work_number ?? '-'})` : '-'}</td>
                        <td>
                          <Link className="btn btn-sm btn-secondary" href={`/applicant/works/${encodeURIComponent(work.work_id)}/preview?${previewParams.toString()}`}>
                            プレビュー
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}