import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { errorToMessage, requireAuthWithRoles } from '../../../lib/auth/request-auth'
import type { RoleId } from '../../../lib/auth/role-security'

const REVIEWER_ROLES: RoleId[] = ['staff', 'staff_primary', 'staff_manager', 'judge', 'contest_admin', 'admin']

type ContestEntryRow = {
  entry_id: number
  contest_id: number
  work_id: string
  user_id: string
  work_number: number
  entry_type: string
  name: string | null
  name_kana: string | null
  status: string
  is_primary_passed: boolean
  created_at: string
}

type EvaluationRow = {
  entry_id: number
  phase: string
  total_score: number
  public_comment: string | null
  is_comment_published: boolean
}

async function nextContestWorkNumber(contestId: number) {
  const { data, error } = await supabaseAdmin
    .from('contest_entries')
    .select('work_number')
    .eq('contest_id', contestId)
    .not('work_number', 'is', null)
    .order('work_number', { ascending: false })
    .limit(1)

  if (error) throw error

  const maxNumber = Array.isArray(data) && data.length > 0 ? Number(data[0].work_number) : 99
  return Number.isFinite(maxNumber) ? maxNumber + 1 : 100
}

async function buildEntryScoreMap(entryIds: number[]) {
  if (entryIds.length === 0) return { primary: {}, final: {} } as {
    primary: Record<number, number>
    final: Record<number, number>
  }

  const { data, error } = await supabaseAdmin
    .from('evaluations')
    .select('entry_id,phase,total_score')
    .in('entry_id', entryIds)
    .eq('status', 'completed')

  if (error) throw error

  const grouped: Record<string, Record<number, number[]>> = { primary: {}, final: {} }
  for (const row of (data || []) as EvaluationRow[]) {
    if (row.phase !== 'primary' && row.phase !== 'final') continue
    const bucket = grouped[row.phase][row.entry_id] || []
    bucket.push(Number(row.total_score || 0))
    grouped[row.phase][row.entry_id] = bucket
  }

  const averageOf = (rows: number[]) => {
    if (!rows.length) return 0
    const sum = rows.reduce((acc, cur) => acc + cur, 0)
    return Math.round((sum / rows.length) * 10) / 10
  }

  const primary: Record<number, number> = {}
  const final: Record<number, number> = {}
  for (const entryId of entryIds) {
    primary[entryId] = averageOf(grouped.primary[entryId] || [])
    final[entryId] = averageOf(grouped.final[entryId] || [])
  }

  return { primary, final }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const url = new URL(req.url)
    const contestIdText = url.searchParams.get('contest_id') || ''
    const contestId = contestIdText ? Number(contestIdText) : null

    if (contestIdText && Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'contest_id must be number' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('contest_entries')
      .select('entry_id,contest_id,work_id,user_id,work_number,entry_type,name,name_kana,status,is_primary_passed,created_at,school_name,grade,guardian_name,guardian_email,guardian_phone,guardian_consent,guardian_consent_at,works(title,category,short_description,work_url,video_location),contests(title,year,status),users(name)')
      .order('work_number', { ascending: true })

    if (contestId !== null) query = query.eq('contest_id', contestId)

    const isReviewer = REVIEWER_ROLES.includes(auth.identity.currentRoleId as RoleId)
    if (!isReviewer) {
      query = query.eq('user_id', auth.identity.userId)
    } else if (auth.identity.currentRoleId === 'judge') {
      query = query.eq('is_primary_passed', true)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const entries = (data || []) as ContestEntryRow[]
    const entryIds = entries.map((e) => e.entry_id)
    const scoreMap = await buildEntryScoreMap(entryIds)

    const response = entries.map((entry) => ({
      ...entry,
      primary_avg_score: scoreMap.primary[entry.entry_id] || 0,
      final_avg_score: scoreMap.final[entry.entry_id] || 0,
    }))

    return NextResponse.json({ entries: response })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['applicant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const contestId = Number(body?.contest_id)
    const workId = typeof body?.work_id === 'string' ? body.work_id : ''
    const entryType = typeof body?.entry_type === 'string' && body.entry_type ? body.entry_type : 'individual'

    if (Number.isNaN(contestId) || !workId) {
      return NextResponse.json({ error: 'contest_id and work_id required' }, { status: 400 })
    }

    const { data: ownWork, error: ownWorkErr } = await supabaseAdmin
      .from('works')
      .select('work_id')
      .eq('work_id', workId)
      .eq('user_id', auth.identity.userId)
      .limit(1)
      .maybeSingle()

    if (ownWorkErr) return NextResponse.json({ error: ownWorkErr.message }, { status: 500 })
    if (!ownWork) return NextResponse.json({ error: 'work not found or not owned' }, { status: 404 })

    const { data: exists, error: existsErr } = await supabaseAdmin
      .from('contest_entries')
      .select('entry_id,work_id,work_number,guardian_consent,status')
      .eq('contest_id', contestId)
      .eq('user_id', auth.identity.userId)
      .limit(1)
      .maybeSingle()

    if (existsErr) return NextResponse.json({ error: existsErr.message }, { status: 500 })

    if (exists) {
      const nextNumber = exists.work_number ?? (await nextContestWorkNumber(contestId))
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('contest_entries')
        .update({
          work_id: workId,
          work_number: nextNumber,
          entry_type: entryType,
          status: 'submitted',
        })
        .eq('entry_id', exists.entry_id)
        .select()
        .single()

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      return NextResponse.json({ entry: updated, replaced: true })
    }

    const nextNumber = await nextContestWorkNumber(contestId)

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('contest_entries')
      .insert({
        contest_id: contestId,
        work_id: workId,
        user_id: auth.identity.userId,
        work_number: nextNumber,
        entry_type: entryType,
        status: 'submitted',
        is_primary_passed: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    return NextResponse.json({ entry: inserted, replaced: false })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['applicant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const contestId = Number(body?.contest_id)
    const entryId = Number(body?.entry_id)
    const workId = typeof body?.work_id === 'string' ? body.work_id : ''
    const entryType = typeof body?.entry_type === 'string' && body.entry_type ? body.entry_type : 'individual'

    if (Number.isNaN(contestId) || !workId) {
      return NextResponse.json({ error: 'contest_id and work_id required' }, { status: 400 })
    }

    const { data: ownWork, error: ownWorkErr } = await supabaseAdmin
      .from('works')
      .select('work_id')
      .eq('work_id', workId)
      .eq('user_id', auth.identity.userId)
      .limit(1)
      .maybeSingle()

    if (ownWorkErr) return NextResponse.json({ error: ownWorkErr.message }, { status: 500 })
    if (!ownWork) return NextResponse.json({ error: 'work not found or not owned' }, { status: 404 })

    let targetEntryQuery = supabaseAdmin
      .from('contest_entries')
      .select('entry_id, contest_id, work_id, work_number, user_id, status')
      .eq('contest_id', contestId)
      .eq('user_id', auth.identity.userId)

    if (Number.isFinite(entryId) && entryId > 0) {
      targetEntryQuery = targetEntryQuery.eq('entry_id', entryId)
    }

    const { data: existingEntry, error: existingEntryErr } = await targetEntryQuery
      .limit(1)
      .maybeSingle()

    if (existingEntryErr) return NextResponse.json({ error: existingEntryErr.message }, { status: 500 })
    if (!existingEntry) return NextResponse.json({ error: 'entry not found' }, { status: 404 })

    const nextNumber = existingEntry.work_number ?? (await nextContestWorkNumber(contestId))

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('contest_entries')
      .update({
        work_id: workId,
        work_number: nextNumber,
        entry_type: entryType,
        status: 'submitted',
      })
      .eq('entry_id', existingEntry.entry_id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ entry: updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['applicant'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const contestId = Number(body?.contest_id)
    const entryId = Number(body?.entry_id)

    if (Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'contest_id required' }, { status: 400 })
    }

    let targetEntryQuery = supabaseAdmin
      .from('contest_entries')
      .select('entry_id, contest_id, work_id, work_number, user_id, status')
      .eq('contest_id', contestId)
      .eq('user_id', auth.identity.userId)

    if (Number.isFinite(entryId) && entryId > 0) {
      targetEntryQuery = targetEntryQuery.eq('entry_id', entryId)
    }

    const { data: existingEntry, error: existingEntryErr } = await targetEntryQuery
      .limit(1)
      .maybeSingle()

    if (existingEntryErr) return NextResponse.json({ error: existingEntryErr.message }, { status: 500 })
    if (!existingEntry) return NextResponse.json({ error: 'entry not found' }, { status: 404 })

    const { data: cleared, error: clearErr } = await supabaseAdmin
      .from('contest_entries')
      .update({
        work_id: null,
        work_number: null,
        status: 'draft',
      })
      .eq('entry_id', existingEntry.entry_id)
      .select()
      .single()

    if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })
    return NextResponse.json({ entry: cleared, cleared: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
