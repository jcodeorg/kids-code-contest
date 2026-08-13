"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type ApplicantProfile = {
  user_id: string
  name: string | null
  name_kana: string | null
  email: string
}

type ContestEntry = {
  entry_id: number
  contest_id: number
  work_id: string | null
  guardian_email: string | null
  guardian_consent: string | null
  guardian_consent_at: string | null
  school_name: string | null
  grade: string | null
  guardian_name: string | null
  guardian_phone: string | null
  status: string | null
  contests?: { title?: string; year?: number; status?: string }
}

export default function ApplicantGuardianPanel({ selectedContestId }: { selectedContestId: number | null }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ApplicantProfile | null>(null)
  const [entry, setEntry] = useState<ContestEntry | null>(null)
  const [guardianEmail, setGuardianEmail] = useState('')
  const [status, setStatus] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

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
        .select('user_id,name,name_kana,email')
        .eq('user_id', user.id)
        .single()

      const safeProfile = profileData as ApplicantProfile | null
      setProfile(safeProfile)

      if (!selectedContestId) {
        setEntry(null)
        setGuardianEmail('')
        return
      }

      const { data: entryData } = await supabase
        .from('contest_entries')
        .select('entry_id,contest_id,work_id,guardian_email,guardian_consent,guardian_consent_at,school_name,grade,guardian_name,guardian_phone,status,contests(title,year,status)')
        .eq('user_id', user.id)
        .eq('contest_id', selectedContestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const safeEntry = entryData as ContestEntry | null
      setEntry(safeEntry)
      setGuardianEmail(safeEntry?.guardian_email || '')
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
  }, [fetchState])

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
    const ok = typeof window !== 'undefined' ? window.confirm('おうちの人に同意メールを送ります。よいですか？') : true
    if (!ok) {
      setStatus('送信を中止しました')
      return
    }

    setStatus('送信中...')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          nameKana: profile.name_kana,
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

  async function resend() {
    await sendConsentRequest({ preventDefault: () => undefined } as React.FormEvent)
  }

  if (loading) return <div className="alert alert-info mb-4">読み込み中...</div>
  if (!profile) return <div className="alert alert-warning mb-4">サインインしてください。</div>

  const needsInitialInput = !guardianEmail
  const consentStatus = entry?.guardian_consent || 'pending'
  const consentLabel = consentStatus === 'approved' ? 'ほごしゃ どういずみ' : consentStatus === 'rejected' ? 'ほごしゃ かくにんちゅう' : 'まだ どういしてない'
  const entryStatusLabel = entry?.status === 'submitted' ? 'さくひん おうぼずみ' : entry?.status === 'draft' ? 'さくひん まだ' : entry?.status || 'まだ'
  const contestLabel = entry?.contests?.title ? `[${entry.contests.year ?? '-'}] ${entry.contests.title}` : (selectedContestId ? `コンテスト: ${selectedContestId}` : 'まだ選んでない')

  if (!detailOpen) {
    return (
      <div className="card bg-base-100 shadow-md border border-base-200 mb-6">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="card-title text-lg">おうぼステータス</h3>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline">{consentLabel}</span>
                <span className="badge badge-outline">{entryStatusLabel}</span>
              </div>
            </div>
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setDetailOpen(true)}>
              もっとみる
            </button>
          </div>
          <div className="text-sm text-base-content/70 mt-2">コンテスト: {contestLabel}</div>
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
          <div>コンテスト: <strong>{contestLabel}</strong></div>
        </div>

        <div className="rounded-box bg-base-200 p-4 text-sm space-y-1">
          <div>おなまえ: <strong>{profile.name || '-'}</strong></div>
          <div>ふりがな: <strong>{profile.name_kana || '-'}</strong></div>
          <div>メール: <strong>{profile.email}</strong></div>
        </div>

        {entry ? (
          <div className="rounded-box bg-base-200 p-4 text-sm space-y-1">
            <div>こんてすと: <strong>{entry.contest_id ?? '-'}</strong></div>
            <div>さくひん: <strong>{entry.work_id ?? '-'}</strong></div>
            <div>おうぼのじょうたい: <strong>{entryStatusLabel}</strong></div>
            <div>ほごしゃ どうい: <strong>{consentLabel}</strong>{entry.guardian_consent_at ? `（${new Date(entry.guardian_consent_at).toLocaleString()}）` : ''}</div>
            <div>がっこう: <strong>{entry.school_name || '-'}</strong></div>
            <div>がくねん: <strong>{entry.grade || '-'}</strong></div>
            <div>ほごしゃのなまえ: <strong>{entry.guardian_name || '-'}</strong></div>
            <div>ほごしゃのでんわ: <strong>{entry.guardian_phone || '-'}</strong></div>
          </div>
        ) : null}

        {needsInitialInput ? (
          <div className="alert alert-warning text-sm">まず、ほごしゃのメールアドレスを入れて、どういメールをおくってください。</div>
        ) : null}

        <form onSubmit={sendConsentRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="form-control w-full md:col-span-2">
            <div className="label"><span className="label-text">ほごしゃのメールアドレス</span></div>
            <input className="input input-bordered w-full" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="おうちの人のメールアドレス" required />
            {guardianEmail && !isValidEmail(guardianEmail) ? (
              <div className="text-xs text-error mt-1">メールアドレスのかたちを かくにんしてください（例: guardian@example.com）</div>
            ) : null}
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit">どういメールを送る</button>
            {!needsInitialInput ? <button className="btn btn-ghost" type="button" onClick={resend}>もういちどおくる</button> : null}
            <button className="btn btn-ghost" type="button" onClick={fetchState}>更新</button>
          </div>
        </form>

        {status ? <div className="alert alert-info mt-3 text-sm">{status}</div> : null}
      </div>
    </div>
  )
}
