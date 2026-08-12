import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = rawEmail.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // 1) Fast path: app profile table
    const { data: profileRows, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('email', email)
      .limit(1)

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    if (Array.isArray(profileRows) && profileRows.length > 0) {
      return NextResponse.json({ exists: true, source: 'profile' })
    }

    // 2) Fallback: Supabase Auth users
    const perPage = 100
    const maxPages = 20
    for (let page = 1; page <= maxPages; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const users = data?.users || []
      const found = users.some((u) => (u.email || '').trim().toLowerCase() === email)
      if (found) {
        return NextResponse.json({ exists: true, source: 'auth' })
      }

      if (users.length < perPage) {
        break
      }
    }

    return NextResponse.json({ exists: false })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
