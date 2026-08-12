import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { errorToMessage } from '../../../lib/auth/request-auth'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('contests')
      .select('contest_id,title,year,status,entry_start_at,entry_end_at,created_at')
      .order('year', { ascending: false })
      .order('contest_id', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contests: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
