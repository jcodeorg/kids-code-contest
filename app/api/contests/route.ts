import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { errorToMessage } from '../../../lib/auth/request-auth'

export async function GET() {
  try {
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
