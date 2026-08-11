"use client"

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function ApplicantGuardianPanel() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [guardianEmail, setGuardianEmail] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')

  async function fetchProfile() {
    setLoading(true)
    try {
      const userRes: any = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (!user?.email) {
        setProfile(null)
        return
      }
      const { data } = await supabase.from('users').select('user_id,name,email,guardian_email,guardian_consent,guardian_consent_at').eq('user_id', user.id).single()
      setProfile(data)
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  async function handleAddGuardian(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.email) return
    if (!guardianEmail) {
      setStatus('保護者メールを入力してください')
      return
    }
    setStatus('送信中...')
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profile.name, email: profile.email, guardianEmail }) })
      const d = await res.json()
      if (!res.ok) {
        setStatus('送信失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('保護者宛に同意メールを送信しました。')
      setEditing(false)
      setGuardianEmail('')
      await fetchProfile()
    } catch (e: any) {
      setStatus('送信に失敗しました: ' + (e?.message || String(e)))
    }
  }

  async function handleResend() {
    if (!profile?.email || !profile.guardian_email) return
    setStatus('再送中...')
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profile.name, email: profile.email, guardianEmail: profile.guardian_email }) })
      const d = await res.json()
      if (!res.ok) {
        setStatus('再送失敗: ' + (d?.error || res.status))
        return
      }
      setStatus('保護者宛に再送しました。')
      await fetchProfile()
    } catch (e: any) {
      setStatus('再送に失敗しました: ' + (e?.message || String(e)))
    }
  }

  if (loading) return <div className="alert alert-info mb-4">読み込み中...</div>
  if (!profile) return <div className="alert alert-warning mb-4">サインインしてください。</div>

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 mb-6">
      <div className="card-body gap-4">
      <h3 className="card-title">保護者同意ステータス</h3>
      <div>
        {profile.guardian_email ? (
          <div>
            <div className="text-sm">保護者メール: <strong>{profile.guardian_email}</strong></div>
            <div className="text-sm mt-1">ステータス: <strong>{profile.guardian_consent || 'pending'}</strong>{profile.guardian_consent_at ? `（${new Date(profile.guardian_consent_at).toLocaleString()}）` : ''}</div>
          </div>
        ) : (
          <div>
            <div className="font-bold">保護者メールが未登録です</div>
            <div className="mt-2 text-sm text-base-content/70">保護者のメールアドレスを登録すると、保護者宛に同意メールが送信されます。保護者が同意すると審査対象になります。</div>
          </div>
        )}
      </div>

      {profile.guardian_email ? (
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={handleResend}>同意メールを再送</button>
          <button className="btn btn-ghost" onClick={fetchProfile}>更新</button>
        </div>
      ) : (
        <div>
          {!editing ? (
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>保護者メールを登録する</button>
            </div>
          ) : (
            <form onSubmit={handleAddGuardian} className="flex flex-col sm:flex-row gap-3 mt-2">
              <input className="input input-bordered w-full" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
              <button className="btn btn-primary" type="submit">送信</button>
              <button className="btn btn-ghost" type="button" onClick={() => { setEditing(false); setGuardianEmail(''); }}>キャンセル</button>
            </form>
          )}
          {status ? <div className="alert alert-info mt-3 text-sm">{status}</div> : null}
        </div>
      )}
      </div>
    </div>
  )
}
