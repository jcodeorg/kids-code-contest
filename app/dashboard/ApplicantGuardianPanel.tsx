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
      const { data } = await supabase.from('users').select('user_id,name,email,guardian_email,guardian_consent,guardian_consent_at').eq('email', user.email).single()
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

  if (loading) return <div style={{ marginBottom: 12 }}>読み込み中...</div>
  if (!profile) return <div style={{ marginBottom: 12 }}>サインインしてください。</div>

  return (
    <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'linear-gradient(90deg,#f8fafc,#ffffff)' }}>
      <h3 style={{ marginTop: 0 }}>保護者同意ステータス</h3>
      <div style={{ marginBottom: 8 }}>
        {profile.guardian_email ? (
          <div>
            <div>保護者メール: <strong>{profile.guardian_email}</strong></div>
            <div>ステータス: <strong>{profile.guardian_consent || 'pending'}</strong>{profile.guardian_consent_at ? `（${new Date(profile.guardian_consent_at).toLocaleString()}）` : ''}</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 700 }}>保護者メールが未登録です</div>
            <div style={{ marginTop: 6 }}>保護者のメールアドレスを登録すると、保護者宛に同意メールが送信されます。保護者が同意すると審査対象になります。</div>
          </div>
        )}
      </div>

      {profile.guardian_email ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleResend}>同意メールを再送</button>
          <button onClick={fetchProfile} style={{ background: 'transparent', color: '#374151', border: '1px solid #e6eef8' }}>更新</button>
        </div>
      ) : (
        <div>
          {!editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)}>保護者メールを登録する</button>
            </div>
          ) : (
            <form onSubmit={handleAddGuardian} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
              <button type="submit">送信</button>
              <button type="button" onClick={() => { setEditing(false); setGuardianEmail(''); }} style={{ background: 'transparent', color: '#374151', border: '1px solid #e6eef8' }}>キャンセル</button>
            </form>
          )}
          <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>{status}</div>
        </div>
      )}
    </div>
  )
}
