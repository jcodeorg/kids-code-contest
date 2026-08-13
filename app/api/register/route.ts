import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../lib/supabase/server'
import { grantRoleToUser, resolveActiveRoleForIdentity } from '../../../lib/auth/role-security'

const resend = new Resend(process.env.RESEND_API_KEY as string)

type DbUserRow = {
  user_id: string
  email: string
}

type InviteRow = {
  invite_id: string
  target_role: string
  max_uses: number | null
  use_count: number
  expires_at: string | null
  status: string
}

type ContestRow = {
  contest_id: number
  title: string
  year: number
  status: string
}

type ContestEntryRow = {
  entry_id: number
  contest_id: number
  user_id: string
  guardian_email: string | null
  guardian_consent: string | null
  guardian_consent_token: string | null
  guardian_consent_at: string | null
  guardian_agreed_ip: string | null
  school_name: string | null
  grade: string | null
  guardian_name: string | null
  guardian_phone: string | null
  work_id: string | null
  work_number: number | null
  entry_type: string | null
  name: string | null
  name_kana: string | null
  team_name: string | null
  team_members: string | null
  status: string | null
  is_primary_passed: boolean | null
}

async function resolveCurrentContest() {
  const { data, error } = await supabaseAdmin
    .from('contests')
    .select('contest_id,title,year,status,is_active')
    .order('year', { ascending: false })
    .order('contest_id', { ascending: false })

  if (error) throw error

  const contests = (data || []) as Array<ContestRow & { is_active?: boolean | null }>
  if (!contests.length) return null

  const active = contests.find((contest) => contest.is_active === true) || contests.find((contest) => ['accepting', 'primary_judging', 'final_judging', 'draft'].includes(contest.status)) || contests[0]
  return active || null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, guardianEmail, inviteToken, authProvider, contest_id: contestIdFromBody } = body || {}
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const safeName = (typeof name === 'string' && name.trim()) ? name.trim() : (typeof email === 'string' ? email.split('@')[0] : 'ユーザー')
    const safeGuardianEmail = typeof guardianEmail === 'string' ? guardianEmail.trim() : ''
    const safeAuthProvider = typeof authProvider === 'string' && authProvider ? authProvider : 'email'

    const ensureAuthUser = async () => {
      try {
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
        if (!listErr) {
          const existing = users.find((u) => u.email === email)
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

    const { data: existingRows, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    let userRecord: DbUserRow | null = null
    let appliedInvite: InviteRow | null = null
    let isNewProfile = false

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const existing = existingRows[0]
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('users')
        .update({
          name: safeName,
          auth_provider: safeAuthProvider,
        })
        .eq('user_id', existing.user_id)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
      userRecord = updated as DbUserRow
    } else {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          user_id: authUser?.id || undefined,
          name: safeName,
          email,
          auth_provider: safeAuthProvider,
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
              auth_provider: safeAuthProvider,
            })
            .eq('user_id', existing.user_id)
            .select()
            .single()

          if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
          }
          userRecord = updated as DbUserRow
        } else {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else {
        userRecord = data as DbUserRow
        isNewProfile = true
      }
    }

    if (!userRecord) {
      return NextResponse.json({ error: 'failed to create or load user profile' }, { status: 500 })
    }

    if (inviteToken) {
      try {
        const { data: invites, error: inviteErr } = await supabaseAdmin.from('invites').select('*').eq('token', inviteToken).limit(1).single()
        if (!inviteErr && invites) {
          const inv = invites as InviteRow
          const now = new Date().toISOString()
          const maxUses = inv.max_uses ?? 1
          const useCount = inv.use_count ?? 0
          const expired = inv.expires_at && inv.expires_at <= now
          const exhausted = (typeof maxUses === 'number' && maxUses > 0 && useCount >= maxUses)
          if (inv.status === 'active' && !expired && !exhausted) {
            await grantRoleToUser({ userId: userRecord.user_id, roleId: inv.target_role, makeCurrent: true })
            await supabaseAdmin.from('invites').update({ use_count: (useCount + 1) }).eq('invite_id', inv.invite_id)
            await supabaseAdmin.from('invite_usages').insert({ invite_id: inv.invite_id, used_by_user_id: userRecord.user_id })
            appliedInvite = inv
          }
        }
      } catch {
        // ignore invite errors
      }
    }

    try {
      if (isNewProfile) {
        await grantRoleToUser({ userId: userRecord.user_id, roleId: 'applicant', makeCurrent: !appliedInvite })
      }
      await resolveActiveRoleForIdentity({ userId: userRecord.user_id, email })
    } catch (e: unknown) {
      console.error('[register] multi-role initialization failed:', e)
      return NextResponse.json({ error: 'multi-role schema is not ready. apply SQL migration first.' }, { status: 500 })
    }

    let contestEntry: ContestEntryRow | null = null
    let contestEntryToken = ''

    if (safeGuardianEmail) {
      const requestedContestId = Number(contestIdFromBody)
      const contest = Number.isFinite(requestedContestId) && requestedContestId > 0
        ? (await supabaseAdmin
            .from('contests')
            .select('contest_id,title,year,status,is_active')
            .eq('contest_id', requestedContestId)
            .limit(1)
            .maybeSingle())?.data
        : await resolveCurrentContest()

      if (!contest) {
        return NextResponse.json({ error: 'contest not found' }, { status: 400 })
      }

      const { data: existingEntry, error: existingEntryErr } = await supabaseAdmin
        .from('contest_entries')
        .select('*')
        .eq('contest_id', contest.contest_id)
        .eq('user_id', userRecord.user_id)
        .limit(1)
        .maybeSingle()

      if (existingEntryErr) {
        return NextResponse.json({ error: existingEntryErr.message }, { status: 500 })
      }

      contestEntryToken = randomUUID()
      const existingContestEntry = (existingEntry || null) as ContestEntryRow | null
      const nextConsent = existingContestEntry?.guardian_consent === 'approved' ? 'approved' : 'pending'

      const entryPayload = {
        contest_id: contest.contest_id,
        user_id: userRecord.user_id,
        guardian_email: safeGuardianEmail,
        guardian_name: existingContestEntry?.guardian_name || null,
        guardian_phone: existingContestEntry?.guardian_phone || null,
        school_name: existingContestEntry?.school_name || null,
        grade: existingContestEntry?.grade || null,
        name: existingContestEntry?.name || null,
        name_kana: existingContestEntry?.name_kana || null,
        guardian_consent: nextConsent,
        guardian_consent_at: nextConsent === 'approved' ? (existingContestEntry?.guardian_consent_at || new Date().toISOString()) : null,
        guardian_consent_token: contestEntryToken,
        guardian_agreed_ip: existingContestEntry?.guardian_agreed_ip || null,
        work_id: existingContestEntry?.work_id || null,
        work_number: existingContestEntry?.work_number ?? null,
        entry_type: existingContestEntry?.entry_type || 'individual',
        team_name: existingContestEntry?.team_name || null,
        team_members: existingContestEntry?.team_members || null,
        status: existingContestEntry?.status || 'draft',
        is_primary_passed: existingContestEntry?.is_primary_passed ?? false,
      }

      const saveRes = existingContestEntry
        ? await supabaseAdmin
          .from('contest_entries')
          .update(entryPayload)
          .eq('entry_id', existingContestEntry.entry_id)
          .select('*')
          .single()
        : await supabaseAdmin
          .from('contest_entries')
          .insert(entryPayload)
          .select('*')
          .single()

      if (saveRes.error) {
        return NextResponse.json({ error: saveRes.error.message }, { status: 500 })
      }

      contestEntry = saveRes.data as ContestEntryRow
    }

    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const consentUrl = contestEntryToken ? `${base.replace(/\/$/, '')}/consent?token=${contestEntryToken}` : ''

    const candidateFrom = process.env.RESEND_FROM || (() => {
      let fromHost = 'example.com'
      try {
        fromHost = new URL(base).hostname
      } catch {
        fromHost = 'example.com'
      }
      return `no-reply@${fromHost}`
    })()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let fromAddress = candidateFrom
    if (!emailRegex.test(fromAddress)) {
      console.warn('[register] RESEND_FROM invalid or constructed from invalid host:', fromAddress)
      fromAddress = 'no-reply@example.com'
    }

    if (safeGuardianEmail && consentUrl) {
      try {
        await resend.emails.send({
          from: fromAddress,
          to: safeGuardianEmail,
          subject: '【要同意】保護者同意のお願い - キッズプログラミングコンテスト',
          html: `
            <p>保護者様</p>
            <p>${safeName} さんの登録がありました。下のリンクを押して保護者同意をお願いします。</p>
            <p><a href="${consentUrl}">同意・確認ページへ</a></p>
            <p>このメールに心当たりがない場合は無視してください。</p>
          `,
        })
      } catch (sendErr) {
        console.error('[Resend API Error]:', sendErr)
        return NextResponse.json({ error: 'Failed to send guardian email' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, user: userRecord, contestEntry, guardianEmailSent: Boolean(safeGuardianEmail && contestEntryToken) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
