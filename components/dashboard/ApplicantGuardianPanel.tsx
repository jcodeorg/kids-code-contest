"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type ApplicantProfile = {
  user_id: string
  name: string | null
  email: string
}

type ContestEntry = {
  entry_id: number
  contest_id: number
  work_id: string | null
  work_number: number | null
  name: string | null
  name_kana: string | null
  guardian_email: string | null
  guardian_consent: string | null
  guardian_consent_at: string | null
  school_name: string | null
  grade: string | null
  guardian_name: string | null
  guardian_phone: string | null
  status: string | null
  contests?: { title?: string; year?: number; status?: string }
  works?: { title?: string }
}

export default function ApplicantGuardianPanel({ selectedContestId, refreshKey }: { selectedContestId: number | null; refreshKey?: number }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ApplicantProfile | null>(null)
  const [entry, setEntry] = useState<ContestEntry | null>(null)
  const [nickname, setNickname] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [status, setStatus] = useState('')
  const [detailOpen, setDetailOpen] = useState(true)

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const fetchState = useCallback(async () => {
    setLoading(true)
    try {
      const userRes = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (!user?.email) {
        setProfile(null)
        setEntry(null)
        return
      }

      const { data: profileData } = await supabase
        .from('users')
        .select('user_id,name,email')
        .eq('user_id', user.id)
        .single()

      const safeProfile = profileData as ApplicantProfile | null
      setProfile(safeProfile)
      setNickname(safeProfile?.name || '')

      if (!selectedContestId) {
        setEntry(null)
        setGuardianEmail('')
        return
      }

      const { data: entryData } = await supabase
        .from('contest_entries')
        .select('entry_id,contest_id,work_id,work_number,name,name_kana,guardian_email,guardian_consent,guardian_consent_at,school_name,grade,guardian_name,guardian_phone,status,contests(title,year,status),works(title)')
        .eq('user_id', user.id)
        .eq('contest_id', selectedContestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const safeEntry = entryData as ContestEntry | null
      const nextGuardianEmail = safeEntry?.guardian_email || ''
      setEntry(safeEntry)
      setGuardianEmail(nextGuardianEmail)
      setDetailOpen(!nextGuardianEmail)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [selectedContestId])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchState()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [fetchState, refreshKey])

  async function sendConsentRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.email) return
    if (!guardianEmail.trim()) {
      setStatus('保護者メールアドレスを入力してください')
      return
    }
    if (!isValidEmail(guardianEmail)) {
      setStatus('メールアドレスの書き方を確認してください')
      return
    }
    const ok = typeof window !== 'undefined' ? window.confirm('おうちの人にメールを おくります。OKを おしてください。') : true
    if (!ok) {
      setStatus('送信を中止しました')
      return
    }

    setStatus('送信中...')
    try {
      const safeNickname = nickname.trim() || profile.name || ''
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: safeNickname,
          nameKana: entry?.name_kana || '',
          email: profile.email,
          guardianEmail,
          contest_id: selectedContestId,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('送れませんでした: ' + (d?.error || res.status))
        return
      }
      setStatus('同意メールを送りました。おうちの人の入力を待っています。')
      await fetchState()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('送れませんでした: ' + message)
    }
  }

  const needsInitialInput = !guardianEmail

  if (loading) return <div className="alert alert-info mb-4">読み込み中...</div>
  if (!profile) return <div className="alert alert-warning mb-4">サインインしてください。</div>

  const consentStatus = entry?.guardian_consent || 'pending'
  const consentLabel = consentStatus === 'approved' ? 'ほごしゃ どういずみ' : consentStatus === 'rejected' ? 'ほごしゃ かくにんちゅう' : 'まだ どういしてない'
  const consentBadgeClass = consentStatus === 'approved' ? 'badge-success' : consentStatus === 'rejected' ? 'badge-warning' : 'badge-warning'
  const entryStatusLabel = entry?.status === 'submitted' ? 'さくひん おうぼずみ' : entry?.status === 'draft' ? 'まだ おうぼしてない' : entry?.status || 'まだ'
  const entryStatusBadgeClass = entry?.status === 'submitted' ? 'badge-success' : entry?.status === 'draft' ? 'badge-warning' : 'badge-outline'

  if (!detailOpen) {
    return (
      <div className="card bg-base-100 shadow-md border border-base-200 mb-6">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="card-title text-lg">おうぼステータス</h3>
              <div className="flex items-center gap-2">
                <span className={`badge ${consentBadgeClass}`}>{consentLabel}</span>
                <span className={`badge ${entryStatusBadgeClass}`}>{entryStatusLabel}</span>
              </div>
            </div>
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setDetailOpen(true)}>
              もっとみる
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 mb-6">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="card-title">おうぼステータス</h3>
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setDetailOpen(false)}>とじる</button>
        </div>

        <div className="rounded-box bg-base-200 p-4 text-sm space-y-1">
          <div>ニックネーム: <strong>{profile.name || '-'}</strong></div>
          <div>メール: <strong>{profile.email}</strong></div>
        </div>

        {entry ? (
          <div className="rounded-box bg-base-200 p-4 text-sm space-y-1">
            <div>正式な名前: <strong>{entry?.name || '-'}</strong></div>
            <div>かな: <strong>{entry?.name_kana || '-'}</strong></div>
            <div>こんてすと: <strong>{entry.contests?.title || '-'}</strong></div>
            <div>さくひん: <strong>{entry.work_number ? `[ #${entry.work_number} ]${entry.works?.title || '-'}` : (entry.works?.title ? entry.works.title : '-')}</strong></div>
            <div>おうぼのじょうたい: <strong>{entryStatusLabel}</strong></div>
            <div>ほごしゃ どうい: <strong>{consentLabel}</strong>{entry.guardian_consent_at ? `（${new Date(entry.guardian_consent_at).toLocaleString()}）` : ''}</div>
            <div>がっこう: <strong>{entry.school_name || '-'}</strong></div>
            <div>がくねん: <strong>{entry.grade || '-'}</strong></div>
            <div>ほごしゃのなまえ: <strong>{entry.guardian_name || '-'}</strong></div>
            <div>ほごしゃのでんわ: <strong>{entry.guardian_phone || '-'}</strong></div>
          </div>
        ) : null}

        {needsInitialInput ? (
          <div className="alert alert-warning text-sm">おうちの人の メール アドレス を入れて、メールを おくってください。</div>
        ) : null}

        <form onSubmit={sendConsentRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="form-control w-full md:col-span-2">
            <div className="label"><span className="label-text">あなたのニックネーム</span></div>
            <input className="input input-bordered w-full" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="あおい" />
          </label>

          <label className="form-control w-full md:col-span-2">
            <div className="label"><span className="label-text">おうちの人のメールアドレス</span></div>
            <input className="input input-bordered w-full" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="おうちの人のメールアドレス" required />
            {guardianEmail && !isValidEmail(guardianEmail) ? (
              <div className="text-xs text-error mt-1">メールアドレスのかたちを かくにんしてください（例: guardian@example.com）</div>
            ) : null}
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit">{needsInitialInput ? 'メールをおくる' : 'メールをもういちど おくる'}</button>
          </div>
        </form>

        {status ? <div className="alert alert-info mt-3 text-sm">{status}</div> : null}
      </div>
    </div>
  )
}
