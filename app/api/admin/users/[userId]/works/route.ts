import { NextResponse } from 'next/server'
import { errorToMessage, requireAuthWithRoles } from '../../../../../../lib/auth/request-auth'
import { supabaseAdmin } from '../../../../../../lib/supabase/server'

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await requireAuthWithRoles(req, ['contest_admin', 'admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { userId } = await params
    const workId = new URL(req.url).searchParams.get('work_id')
    if (!userId || !workId) {
      return NextResponse.json({ error: 'userId and work_id are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('works')
      .select('work_id,user_id,title,category,has_hardware,short_description,detailed_description,work_url,video_type,video_location,thumbnail_url,created_at,updated_at')
      .eq('user_id', userId)
      .eq('work_id', workId)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ works: data ? [data] : [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}