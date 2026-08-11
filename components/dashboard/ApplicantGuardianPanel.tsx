"use client"

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function ApplicantGuardianPanel() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [name, setName] = useState('')
  const [nameKana, setNameKana] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade, setGrade] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function fetchProfile() {
    setLoading(true)
    try {
      const userRes: any = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (!user?.email) {
        setProfile(null)
        return
      }
      const { data } = await supabase
        .from('users')
        .select('user_id,name,name_kana,school_name,grade,email,guardian_email,guardian_consent,guardian_consent_at')
        .eq('user_id', user.id)
        .single()
      setProfile(data)
      setName(data?.name || user.user_metadata?.name || user.email?.split('@')[0] || '')
      setNameKana(data?.name_kana || '')
      setSchoolName(data?.school_name || '')
      setGrade(data?.grade || '')
      setGuardianEmail(data?.guardian_email || '')
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  async function handleRegisterApplicant(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.email) return
    if (!name || !nameKana || !schoolName || !grade || !guardianEmail) {
      setStatus('すべての項目を入力してください')
      return
    }
    if (!isValidEmail(guardianEmail)) {
      setStatus('メールアドレスの書き方を確認してください')
      return
    }
    // 子どもでも分かる簡単な確認
    const ok = typeof window !== 'undefined' ? window.confirm('おうちの人にメールを送ります。よいですか？') : true
    if (!ok) {
      setStatus('送信を中止しました')
      return
    }
    setStatus('送信中...')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nameKana, schoolName, grade, email: profile.email, guardianEmail }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('送れませんでした: ' + (d?.error || res.status))
        return
      }
      setStatus('情報を保存しました。おうちの人にメールを送りました。')
      setEditing(false)
      await fetchProfile()
    } catch (e: any) {
      setStatus('送れませんでした: ' + (e?.message || String(e)))
    }
  }

  async function handleResend() {
    if (!profile?.email || !guardianEmail) return
    if (!isValidEmail(guardianEmail)) {
      setStatus('メールアドレスの書き方を確認してください')
      return
    }
    const ok = typeof window !== 'undefined' ? window.confirm('おうちの人にもう一度メールを送ります。よいですか？') : true
    if (!ok) {
      setStatus('再送を中止しました')
      return
    }
    setStatus('再送中...')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nameKana, schoolName, grade, email: profile.email, guardianEmail }),
      })
      const d = await res.json()
      if (!res.ok) {
        setStatus('再送できませんでした: ' + (d?.error || res.status))
        return
      }
      setStatus('おうちの人にもう一度メールを送りました。')
      await fetchProfile()
    } catch (e: any) {
      setStatus('再送できませんでした: ' + (e?.message || String(e)))
    }
  }

  if (loading) return <div className="alert alert-info mb-4">読み込み中...</div>
  if (!profile) return <div className="alert alert-warning mb-4">サインインしてください。</div>

  const needsInitialInput = !name || !nameKana || !schoolName || !grade || !guardianEmail

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 mb-6">
      <div className="card-body gap-4">
      <h3 className="card-title">応募者情報と保護者同意</h3>

      {needsInitialInput ? (
        <div className="alert alert-warning text-sm">まず、おうぼしゃの情報を入力してください。入力後におうちの人にメールを送ります。</div>
      ) : null}

      {!needsInitialInput && !editing ? (
        <>
          <div>
            <div className="text-sm">お名前: <strong>{name}</strong></div>
            <div className="text-sm">ふりがな: <strong>{nameKana}</strong></div>
            <div className="text-sm">学校: <strong>{schoolName}</strong></div>
            <div className="text-sm">学年: <strong>{grade}</strong></div>
            <div className="text-sm">おうちの人のメール: <strong>{guardianEmail}</strong></div>
            <div className="text-sm mt-1">同意状況: <strong>{profile.guardian_consent || 'pending'}</strong>{profile.guardian_consent_at ? `（${new Date(profile.guardian_consent_at).toLocaleString()}）` : ''}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={handleResend}>同意メールを再送</button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>情報を修正</button>
            <button className="btn btn-ghost" onClick={fetchProfile}>更新</button>
          </div>
        </>
      ) : (
        <form onSubmit={handleRegisterApplicant} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">お名前</span></div>
            <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="form-control w-full">
            <div className="label"><span className="label-text">ふりがな</span></div>
            <input className="input input-bordered w-full" value={nameKana} onChange={(e) => setNameKana(e.target.value)} required />
          </label>

          <label className="form-control w-full">
            <div className="label"><span className="label-text">学校</span></div>
            <input className="input input-bordered w-full" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
          </label>

          <label className="form-control w-full">
            <div className="label"><span className="label-text">学年</span></div>
            <select className="select select-bordered w-full" value={grade} onChange={(e) => setGrade(e.target.value)} required>
              <option value="">えらんでください</option>
              <option value="小1">小1</option>
              <option value="小2">小2</option>
              <option value="小3">小3</option>
              <option value="小4">小4</option>
              <option value="小5">小5</option>
              <option value="小6">小6</option>
              <option value="中1">中1</option>
              <option value="中2">中2</option>
              <option value="中3">中3</option>
            </select>
          </label>

          <label className="form-control w-full md:col-span-2">
            <div className="label"><span className="label-text">おうちの人のメール</span></div>
            <input className="input input-bordered w-full" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="おうちの人のメールアドレス" required />
            {guardianEmail && !isValidEmail(guardianEmail) ? (
              <div className="text-xs text-error mt-1">メールアドレスの書き方を確認してください（例: guardian@example.com）</div>
            ) : null}
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit">おうちの人にメールを送る</button>
            {!needsInitialInput ? <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>キャンセル</button> : null}
          </div>
        </form>
      )}

      {status ? <div className="alert alert-info mt-3 text-sm">{status}</div> : null}
      </div>
    </div>
  )
}
