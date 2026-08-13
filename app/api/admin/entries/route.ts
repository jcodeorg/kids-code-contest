import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { errorToMessage, requireAuthWithRoles } from '../../../../lib/auth/request-auth'

type AggregatedRow = {
  entry_id: number
  score: number
}

async function loadRanking(contestId: number, phase: 'primary' | 'final') {
  const { data: entries, error: entryErr } = await supabaseAdmin
    .from('contest_entries')
    .select('entry_id,contest_id,work_number,is_primary_passed,works(title,category),users(name)')
    .eq('contest_id', contestId)
    .order('work_number', { ascending: true })

  if (entryErr) throw entryErr

  const entryIds = (entries || []).map((e: { entry_id: number }) => e.entry_id)
  if (entryIds.length === 0) return []

  const { data: evals, error: evalErr } = await supabaseAdmin
    .from('evaluations')
    .select('entry_id,total_score')
    .in('entry_id', entryIds)
    .eq('phase', phase)
    .eq('status', 'completed')

  if (evalErr) throw evalErr

  const grouped: Record<number, number[]> = {}
  for (const row of evals || []) {
    const bucket = grouped[row.entry_id as number] || []
    bucket.push(Number(row.total_score || 0))
    grouped[row.entry_id as number] = bucket
  }

  const toAvg = (scores: number[]) => {
    if (!scores.length) return 0
    const sum = scores.reduce((acc, cur) => acc + cur, 0)
    return Math.round((sum / scores.length) * 10) / 10
  }

  const rows: AggregatedRow[] = entryIds.map((entryId) => ({ entry_id: entryId, score: toAvg(grouped[entryId] || []) }))
  const rankById: Record<number, number> = {}
  rows
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((row, idx) => {
      rankById[row.entry_id] = idx + 1
    })

  return (entries || []).map((entry: { entry_id: number } & Record<string, unknown>) => ({
    ...entry,
    avg_score: rows.find((r) => r.entry_id === entry.entry_id)?.score || 0,
    rank: rankById[entry.entry_id] || null,
  }))
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const url = new URL(req.url)
    const contestId = Number(url.searchParams.get('contest_id') || '')
    const phase = (url.searchParams.get('phase') || 'primary') as 'primary' | 'final'
    const view = url.searchParams.get('view') || 'ranking'

    if (Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'contest_id is required' }, { status: 400 })
    }

    if (view === 'entries') {
      const { data: entries, error } = await supabaseAdmin
        .from('contest_entries')
        .select('entry_id, contest_id, work_id, work_number, status, entry_type, name, name_kana, school_name, grade, guardian_name, guardian_email, guardian_consent, guardian_consent_at, users(name, email), works(title, category)')
        .eq('contest_id', contestId)
        .order('work_number', { ascending: true, nullsFirst: false })

      if (error) throw error

      return NextResponse.json({ entries: entries || [] })
    }

    if (phase !== 'primary' && phase !== 'final') {
      return NextResponse.json({ error: 'valid phase is required' }, { status: 400 })
    }

    const ranking = await loadRanking(contestId, phase)
    return NextResponse.json({ ranking })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const action = typeof body?.action === 'string' ? body.action : ''
    const contestId = Number(body?.contest_id)

    if (!action || Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'action and contest_id are required' }, { status: 400 })
    }

    if (action === 'mark_primary_passed') {
      const topN = Number(body?.top_n || 20)
      const ranking = await loadRanking(contestId, 'primary')
      const passIds = ranking
        .slice()
        .sort((a, b) => Number(b.avg_score || 0) - Number(a.avg_score || 0))
        .slice(0, topN)
        .map((r) => Number(r.entry_id))

      await supabaseAdmin.from('contest_entries').update({ is_primary_passed: false }).eq('contest_id', contestId)
      if (passIds.length > 0) {
        await supabaseAdmin.from('contest_entries').update({ is_primary_passed: true }).in('entry_id', passIds)
      }

      return NextResponse.json({ ok: true, passed_entry_ids: passIds })
    }

    if (action === 'publish_final_comments') {
      const { error } = await supabaseAdmin
        .from('evaluations')
        .update({ is_comment_published: true })
        .eq('phase', 'final')
        .in(
          'entry_id',
          (
            await supabaseAdmin.from('contest_entries').select('entry_id').eq('contest_id', contestId)
          ).data?.map((row: { entry_id: number }) => row.entry_id) || [],
        )

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unsupported action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
