import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'

export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin.from('invites').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invites: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { target_role, max_uses, expires_in_hours } = body
    if (!target_role) return NextResponse.json({ error: 'target_role required' }, { status: 400 })

    const token = crypto.randomUUID()
    const now = new Date()
    const hours = Number(expires_in_hours || 24)
    const expires_at = new Date(now.getTime() + hours * 3600 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('invites')
      .insert({ token, target_role, max_uses: max_uses ?? 1, use_count: 0, status: 'active', expires_at })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { invite_id, status } = body
    if (!invite_id || !status) return NextResponse.json({ error: 'invite_id and status required' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from('invites').update({ status }).eq('invite_id', invite_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
