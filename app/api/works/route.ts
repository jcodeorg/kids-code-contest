import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { errorToMessage, requireAuthWithRoles } from '../../../lib/auth/request-auth'

const WORK_CATEGORIES = ['scratch', 'microbit', 'web_app', 'python', 'other'] as const

type WorkCategory = (typeof WORK_CATEGORIES)[number]

function isValidCategory(value: string): value is WorkCategory {
  return WORK_CATEGORIES.includes(value as WorkCategory)
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await supabaseAdmin
      .from('works')
      .select('work_id,user_id,title,category,has_hardware,short_description,detailed_description,work_url,video_type,video_location,thumbnail_url,created_at,updated_at')
      .eq('user_id', auth.identity.userId)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ works: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const requestedCategory = typeof body?.category === 'string' ? body.category.trim() : ''
    const category = isValidCategory(requestedCategory) ? requestedCategory : 'scratch'
    const shortDescription = typeof body?.short_description === 'string' ? body.short_description.trim() : ''
    const detailedDescription = typeof body?.detailed_description === 'string' ? body.detailed_description.trim() : ''
    const workUrl = typeof body?.work_url === 'string' ? body.work_url.trim() : ''
    const videoType = typeof body?.video_type === 'string' ? body.video_type.trim() : 'youtube_url'
    const videoLocation = typeof body?.video_location === 'string' ? body.video_location.trim() : ''
    const thumbnailUrl = typeof body?.thumbnail_url === 'string' ? body.thumbnail_url.trim() : ''
    const hasHardware = Boolean(body?.has_hardware)

    if (!title) {
      return NextResponse.json({ error: 'required fields are missing' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('works')
      .insert({
        user_id: auth.identity.userId,
        title,
        category,
        has_hardware: hasHardware,
        short_description: shortDescription,
        detailed_description: detailedDescription,
        work_url: workUrl,
        video_type: videoType,
        video_location: videoLocation,
        thumbnail_url: thumbnailUrl,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ work: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const workId = typeof body?.work_id === 'string' ? body.work_id : ''
    if (!workId) return NextResponse.json({ error: 'work_id required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (typeof body?.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (typeof body?.category === 'string' && isValidCategory(body.category.trim())) updates.category = body.category.trim()
    if (typeof body?.short_description === 'string') updates.short_description = body.short_description.trim()
    if (typeof body?.detailed_description === 'string') updates.detailed_description = body.detailed_description.trim()
    if (typeof body?.work_url === 'string') updates.work_url = body.work_url.trim()
    if (body?.video_type === 'youtube_url' || body?.video_type === 'mp4_file') updates.video_type = body.video_type
    if (typeof body?.video_location === 'string') updates.video_location = body.video_location.trim()
    if (typeof body?.thumbnail_url === 'string') updates.thumbnail_url = body.thumbnail_url.trim()
    if (typeof body?.has_hardware === 'boolean') updates.has_hardware = body.has_hardware

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updates provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('works')
      .update(updates)
      .eq('work_id', workId)
      .eq('user_id', auth.identity.userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 作品更新時、審査済みの評価を再審査要求に戻す
    await supabaseAdmin
      .from('evaluations')
      .update({ status: 're_examine_required', updated_at: new Date().toISOString() })
      .in(
        'entry_id',
        (
          await supabaseAdmin.from('contest_entries').select('entry_id').eq('work_id', workId)
        ).data?.map((r: { entry_id: number }) => r.entry_id) || [],
      )
      .eq('status', 'completed')

    return NextResponse.json({ work: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const workId = typeof body?.work_id === 'string' ? body.work_id : ''
    if (!workId) return NextResponse.json({ error: 'work_id required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('works')
      .delete()
      .eq('work_id', workId)
      .eq('user_id', auth.identity.userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorToMessage(err) }, { status: 500 })
  }
}
