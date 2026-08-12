import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, name, nameKana, schoolName, grade, guardianName, guardianPhone, guardianEmail } = body || {}
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    if (!guardianName || !guardianPhone) return NextResponse.json({ error: 'guardianName and guardianPhone required' }, { status: 400 })

    const now = new Date().toISOString()
    const updateCols: Record<string, string> = {
      guardian_consent: 'approved',
      guardian_consent_at: now,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
    }
    if (guardianEmail) updateCols.guardian_email = guardianEmail
    if (name) updateCols.name = name
    if (nameKana) updateCols.name_kana = nameKana
    if (schoolName) updateCols.school_name = schoolName
    if (grade) updateCols.grade = grade

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateCols)
      .eq('guardian_consent_token', token)
      .select()
      .single()

    if (error) {
      // if no rows found, Supabase returns 406 or 400 depending; map to 404
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ ok: true, user: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
