import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'
import { errorToMessage, requireAuthWithRoles } from '../../../../lib/auth/request-auth'

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await supabaseAdmin
      .from('contests')
      .select('contest_id,title,year,status,is_active,entry_start_at,entry_end_at,created_at')
      .order('year', { ascending: false })
      .order('contest_id', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const contests = (data || []) as Array<{ contest_id: number; title: string; year: number; status: string; is_active?: boolean | null }>
    const activeContest = contests.find((contest) => contest.is_active) || contests.find((contest) => ['accepting', 'draft', 'primary_judging', 'final_judging'].includes(contest.status)) || contests[0] || null

    return NextResponse.json({ contests, active_contest: activeContest })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const year = Number(body?.year)
    const status = typeof body?.status === 'string' && body.status ? body.status : 'draft'
    const entryStartAt = typeof body?.entry_start_at === 'string' ? body.entry_start_at : null
    const entryEndAt = typeof body?.entry_end_at === 'string' ? body.entry_end_at : null
    const shouldSetActive = body?.is_active === true

    if (!title || Number.isNaN(year) || !entryStartAt || !entryEndAt) {
      return NextResponse.json({ error: 'title, year, entry_start_at, entry_end_at are required' }, { status: 400 })
    }

    if (shouldSetActive) {
      const { error: clearErr } = await supabaseAdmin.from('contests').update({ is_active: false }).neq('contest_id', 0)
      if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('contests')
      .insert({
        title,
        year,
        status,
        is_active: shouldSetActive,
        entry_start_at: entryStartAt,
        entry_end_at: entryEndAt,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contest: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const contestId = Number(body?.contest_id)
    if (Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'contest_id is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body?.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (!Number.isNaN(Number(body?.year))) updates.year = Number(body.year)
    if (typeof body?.status === 'string' && body.status) updates.status = body.status
    if (typeof body?.entry_start_at === 'string') updates.entry_start_at = body.entry_start_at
    if (typeof body?.entry_end_at === 'string') updates.entry_end_at = body.entry_end_at

    if (body && Object.prototype.hasOwnProperty.call(body, 'is_active')) {
      const nextIsActive = Boolean(body.is_active)
      if (nextIsActive) {
        const { error: clearErr } = await supabaseAdmin.from('contests').update({ is_active: false }).neq('contest_id', contestId)
        if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })
      }
      updates.is_active = nextIsActive
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updates provided' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('contests')
      .update(updates)
      .eq('contest_id', contestId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contest: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const contestId = Number(body?.contest_id)
    if (Number.isNaN(contestId)) {
      return NextResponse.json({ error: 'contest_id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('contests')
      .delete()
      .eq('contest_id', contestId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
