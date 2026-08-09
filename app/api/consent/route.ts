import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ guardian_consent: 'approved', guardian_consent_at: now })
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
