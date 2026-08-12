import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, name, nameKana, schoolName, grade, guardianName, guardianPhone, guardianEmail } = body || {}
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    if (!guardianName || !guardianPhone) return NextResponse.json({ error: 'guardianName and guardianPhone required' }, { status: 400 })

    const now = new Date().toISOString()
    const { data: entry, error: fetchErr } = await supabaseAdmin
      .from('contest_entries')
      .select('entry_id,user_id')
      .eq('guardian_consent_token', token)
      .limit(1)
      .single()

    if (fetchErr || !entry) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }

    const updateCols: Record<string, string | null> = {
      guardian_consent: 'approved',
      guardian_consent_at: now,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      school_name: schoolName || null,
      grade: grade || null,
    }
    if (guardianEmail) updateCols.guardian_email = guardianEmail

    const { data, error } = await supabaseAdmin
      .from('contest_entries')
      .update(updateCols)
      .eq('guardian_consent_token', token)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (name || nameKana) {
      const userUpdate: Record<string, string> = {}
      if (name) userUpdate.name = name
      if (nameKana) userUpdate.name_kana = nameKana
      if (Object.keys(userUpdate).length > 0) {
        await supabaseAdmin.from('users').update(userUpdate).eq('user_id', entry.user_id)
      }
    }

    return NextResponse.json({ ok: true, contestEntry: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
