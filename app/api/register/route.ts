import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY as string)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, guardianEmail } = body
    if (!email || !guardianEmail) {
      return NextResponse.json({ error: 'email and guardianEmail are required' }, { status: 400 })
    }

    // check existing user by email to avoid unique constraint violation
    const { data: existingRows, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const token = crypto.randomUUID()
    let userRecord: any = null

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      // existing user: update token and set consent back to pending, then resend
      const existing = existingRows[0]
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('users')
        .update({
          guardian_email: guardianEmail,
          guardian_consent: 'pending',
          guardian_consent_token: token,
        })
        .eq('user_id', existing.user_id)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
      userRecord = updated
    } else {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          name: name || null,
          email,
          guardian_email: guardianEmail,
          guardian_consent: 'pending',
          guardian_consent_token: token,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      userRecord = data
    }

    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const consentUrl = `${base.replace(/\/$/, '')}/consent?token=${token}`

    // Determine `from` address: prefer RESEND_FROM env var, else build from app host.
    const candidateFrom = process.env.RESEND_FROM || (() => {
      let fromHost = 'example.com'
      try {
        fromHost = new URL(base).hostname
      } catch (e) {
        fromHost = 'example.com'
      }
      return `no-reply@${fromHost}`
    })()

    // simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let fromAddress = candidateFrom
    if (!emailRegex.test(fromAddress)) {
      console.warn('[register] RESEND_FROM invalid or constructed from invalid host:', fromAddress)
      fromAddress = 'no-reply@example.com'
    }

    try {
      await resend.emails.send({
        from: fromAddress,
        to: guardianEmail,
        subject: '【要同意】保護者同意のお願い - キッズプログラミングコンテスト',
        html: `
        <p>保護者様</p>
        <p>${name || '参加者'} さんの登録がありました。下のリンクを押して保護者同意をお願いします。</p>
        <p><a href="${consentUrl}">同意・確認ページへ</a></p>
        <p>このメールに心当たりがない場合は無視してください。</p>
      `,
      })
    } catch (sendErr) {
      console.error('[Resend API Error]:', sendErr)
      return NextResponse.json({ error: 'Failed to send guardian email' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: userRecord })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
