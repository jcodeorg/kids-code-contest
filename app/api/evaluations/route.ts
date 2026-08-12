import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { errorToMessage, requireAuthWithRoles } from '../../../lib/auth/request-auth'
import type { RoleId } from '../../../lib/auth/role-security'

const PRIMARY_ROLES: RoleId[] = ['staff', 'staff_primary', 'staff_manager', 'contest_admin', 'admin']
const FINAL_ROLES: RoleId[] = ['judge', 'contest_admin', 'admin']

function toScoreInt(value: unknown) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n
}

function toScoreOther(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1 || n > 5) return null
  return Math.round(n * 10) / 10
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const url = new URL(req.url)
    const entryId = Number(url.searchParams.get('entry_id') || '')
    const contestId = Number(url.searchParams.get('contest_id') || '')
    const phase = url.searchParams.get('phase') || ''

    let query = supabaseAdmin
      .from('evaluations')
      .select('evaluation_id,entry_id,evaluator_id,phase,score_originality,score_skill,score_effort,score_purpose,score_other,total_score,public_comment,private_comment,is_comment_published,status,updated_at,contest_entries(contest_id,user_id,work_number)')
      .order('updated_at', { ascending: false })

    if (!Number.isNaN(entryId) && entryId > 0) query = query.eq('entry_id', entryId)
    if (!Number.isNaN(contestId) && contestId > 0) query = query.eq('contest_entries.contest_id', contestId)
    if (phase) query = query.eq('phase', phase)

    if (auth.identity.currentRoleId === 'applicant') {
      query = query.eq('contest_entries.user_id', auth.identity.userId).eq('is_comment_published', true)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ evaluations: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const entryId = Number(body?.entry_id)
    const phase = typeof body?.phase === 'string' ? body.phase : ''

    if (Number.isNaN(entryId) || entryId <= 0 || (phase !== 'primary' && phase !== 'final')) {
      return NextResponse.json({ error: 'entry_id and valid phase are required' }, { status: 400 })
    }

    if (phase === 'primary' && !PRIMARY_ROLES.includes(auth.identity.currentRoleId as RoleId)) {
      return NextResponse.json({ error: 'primary evaluation role required' }, { status: 403 })
    }
    if (phase === 'final' && !FINAL_ROLES.includes(auth.identity.currentRoleId as RoleId)) {
      return NextResponse.json({ error: 'final evaluation role required' }, { status: 403 })
    }

    const { data: entry, error: entryErr } = await supabaseAdmin
      .from('contest_entries')
      .select('entry_id,is_primary_passed')
      .eq('entry_id', entryId)
      .limit(1)
      .maybeSingle()

    if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })
    if (!entry) return NextResponse.json({ error: 'entry not found' }, { status: 404 })
    if (phase === 'final' && !entry.is_primary_passed) {
      return NextResponse.json({ error: 'entry did not pass primary phase' }, { status: 400 })
    }

    const scoreOriginality = toScoreInt(body?.score_originality)
    const scoreSkill = toScoreInt(body?.score_skill)
    const scoreEffort = toScoreInt(body?.score_effort)
    const scorePurpose = toScoreInt(body?.score_purpose)
    const scoreOther = toScoreOther(body?.score_other)

    if (!scoreOriginality || !scoreSkill || !scoreEffort || !scorePurpose || scoreOther === null) {
      return NextResponse.json({ error: 'invalid score values' }, { status: 400 })
    }

    const publicComment = typeof body?.public_comment === 'string' ? body.public_comment.trim() : ''
    const privateComment = typeof body?.private_comment === 'string' ? body.private_comment.trim() : ''

    if (phase === 'final' && !publicComment) {
      return NextResponse.json({ error: 'public_comment is required in final phase' }, { status: 400 })
    }

    const totalScore = Math.round((scoreOriginality + scoreSkill + scoreEffort + scorePurpose + scoreOther) * 10) / 10
    const status = typeof body?.status === 'string' && body.status ? body.status : 'completed'

    const { data, error } = await supabaseAdmin
      .from('evaluations')
      .upsert(
        {
          entry_id: entryId,
          evaluator_id: auth.identity.userId,
          phase,
          score_originality: scoreOriginality,
          score_skill: scoreSkill,
          score_effort: scoreEffort,
          score_purpose: scorePurpose,
          score_other: scoreOther,
          total_score: totalScore,
          public_comment: publicComment || null,
          private_comment: privateComment || null,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entry_id,evaluator_id,phase' },
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ evaluation: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
