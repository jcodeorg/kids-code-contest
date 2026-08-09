import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/server'

const VALID_ROLES = ['applicant', 'staff_primary', 'staff_manager', 'judge', 'admin']

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || undefined
    const role = url.searchParams.get('role') || undefined
    const guardian = url.searchParams.get('guardian') || undefined

    let query = supabaseAdmin.from('users').select('user_id,email,name,role,guardian_consent,is_active,created_at').order('created_at', { ascending: false })
    if (q) {
      query = query.ilike('email', `%${q}%`).or(`name.ilike.%${q}%`)
    }
    if (role) query = query.eq('role', role)
    if (guardian) query = query.eq('guardian_consent', guardian)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { user_id, role, is_active } = body
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    const updates: any = {}
    if (role) {
      if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'invalid role' }, { status: 400 })
      updates.role = role
    }
    if (typeof is_active === 'boolean') updates.is_active = is_active

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates provided' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from('users').update(updates).eq('user_id', user_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ user: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
