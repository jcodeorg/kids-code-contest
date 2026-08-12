import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'
import { grantRoleToUser, resolveActiveRoleForIdentity } from '../../../lib/auth/role-security'

const resend = new Resend(process.env.RESEND_API_KEY as string)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, nameKana, schoolName, grade, email, guardianEmail, inviteToken, authProvider } = body
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const safeName = (typeof name === 'string' && name.trim()) ? name.trim() : (typeof email === 'string' ? email.split('@')[0] : 'ユーザー')
    const safeNameKana = (typeof nameKana === 'string' && nameKana.trim()) ? nameKana.trim() : null
    const safeSchoolName = (typeof schoolName === 'string' && schoolName.trim()) ? schoolName.trim() : null
    const safeGrade = (typeof grade === 'string' && grade.trim()) ? grade.trim() : null
    const safeGuardianEmail = typeof guardianEmail === 'string' ? guardianEmail.trim() : ''
    const safeAuthProvider = typeof authProvider === 'string' && authProvider ? authProvider : 'email'

    const ensureAuthUser = async () => {
      try {
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
        if (!listErr) {
          const existing = users.find((u: any) => u.email === email)
          if (existing) {
            return existing
          }
        }

        const password = randomUUID()
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: safeName,
            auth_provider: safeAuthProvider,
          },
          app_metadata: {
            auth_provider: safeAuthProvider,
          },
        })

        if (error) {
          console.warn('[register] auth user create failed:', error.message)
          return null
        }
        return data.user
      } catch (e) {
        console.warn('[register] ensureAuthUser exception:', e)
        return null
      }
    }

    const authUser = await ensureAuthUser()

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
    let appliedInvite: any = null

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      // existing user: update token and set consent back to pending, then resend
      const existing = existingRows[0]
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('users')
        .update({
          name: safeName,
          name_kana: safeNameKana,
          school_name: safeSchoolName,
          grade: safeGrade,
          guardian_email: safeGuardianEmail || null,
          guardian_consent: 'pending',
          guardian_consent_token: token,
          auth_provider: safeAuthProvider,
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
          user_id: authUser?.id || undefined,
          name: safeName,
          name_kana: safeNameKana,
          school_name: safeSchoolName,
          grade: safeGrade,
          email,
          auth_provider: safeAuthProvider,
          guardian_email: safeGuardianEmail || null,
          guardian_consent: 'pending',
          guardian_consent_token: token,
        })
        .select()
        .single()

      if (error) {
        const isDuplicate = error.code === '23505' || /duplicate|already exists|violat/i.test(error.message)
        if (!isDuplicate) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const { data: existingAfterInsert, error: refetchErr } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .limit(1)

        if (refetchErr) {
          return NextResponse.json({ error: refetchErr.message }, { status: 500 })
        }

        if (Array.isArray(existingAfterInsert) && existingAfterInsert.length > 0) {
          const existing = existingAfterInsert[0]
          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('users')
            .update({
              name: safeName,
              name_kana: safeNameKana,
              school_name: safeSchoolName,
              grade: safeGrade,
              guardian_email: safeGuardianEmail || null,
              guardian_consent: 'pending',
              guardian_consent_token: token,
              auth_provider: safeAuthProvider,
            })
            .eq('user_id', existing.user_id)
            .select()
            .single()

          if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
          }
          userRecord = updated
        } else {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else {
        userRecord = data
      }
    }

    // If inviteToken provided, validate and apply role
    if (inviteToken) {
      try {
        const { data: invites, error: inviteErr } = await supabaseAdmin.from('invites').select('*').eq('token', inviteToken).limit(1).single()
        if (!inviteErr && invites) {
          const inv = invites as any
          const now = new Date().toISOString()
          const maxUses = inv.max_uses ?? 1
          const useCount = inv.use_count ?? 0
          const expired = inv.expires_at && inv.expires_at <= now
          const exhausted = (typeof maxUses === 'number' && maxUses > 0 && useCount >= maxUses)
          if (inv.status === 'active' && !expired && !exhausted) {
            // 多重ロールに付与し、招待ロールをアクティブに切替
            await grantRoleToUser({ userId: userRecord.user_id, roleId: inv.target_role, makeCurrent: true })
            // increment use_count
            await supabaseAdmin.from('invites').update({ use_count: (useCount + 1) }).eq('invite_id', inv.invite_id)
            // record usage
            await supabaseAdmin.from('invite_usages').insert({ invite_id: inv.invite_id, used_by_user_id: userRecord.user_id })
            appliedInvite = inv
          }
        }
      } catch (e) {
        // ignore invite errors
      }
    }

    // 通常登録でも最低1ロール(applicant)を確保。剥奪時フォールバックの土台になる。
    try {
      await grantRoleToUser({ userId: userRecord.user_id, roleId: 'applicant', makeCurrent: !appliedInvite })
      await resolveActiveRoleForIdentity({ userId: userRecord.user_id, email })
    } catch (e: unknown) {
      console.error('[register] multi-role initialization failed:', e)
      return NextResponse.json({ error: 'multi-role schema is not ready. apply SQL migration first.' }, { status: 500 })
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

    // send guardian consent email only when guardianEmail provided
    if (safeGuardianEmail) {
      try {
        await resend.emails.send({
          from: fromAddress,
          to: safeGuardianEmail,
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
    }

    return NextResponse.json({ ok: true, user: userRecord, guardianEmailSent: Boolean(safeGuardianEmail) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
