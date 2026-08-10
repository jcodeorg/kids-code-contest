'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

function SignInPageContent() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const searchParams = useSearchParams()
  const inviteToken = searchParams?.get('token') || ''

  async function signInWithGoogle() {
    setStatus('Googleでサインイン中...')
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          flowType: 'pkce',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      } as any)
      // OAuth redirects to provider; no further action here
    } catch (err: any) {
      setStatus('OAuth エラー: ' + (err?.message || String(err)))
    }
  }

  async function fetchRoleAndRedirect() {
    try {
      const userRes: any = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (!user?.email) return
      // try to read profile; if missing, create via server API (handles OAuth signups)
      try {
        const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
        const role = profile?.role || 'applicant'
        router.push(`/dashboard/${role}`)
        return
      } catch (e) {
        // profile missing — create it server-side
        try {
          const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0]
          await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: user.email }) })
        } catch (err) {
          // ignore
        }
        // redirect to applicant dashboard by default
        router.push('/dashboard/applicant')
        return
      }
    } catch (e) {
      // fallback
      router.push('/dashboard/applicant')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('認証中...')
    try {
      const res = await supabase.auth.signInWithPassword({ email, password } as any)
      if (res.error) {
        setStatus('サインイン失敗: ' + res.error.message)
        return
      }
      // if invite token present, apply to this user
      if (inviteToken) {
        try {
          await fetch('/api/invite/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inviteToken, email }) })
        } catch (e) {
          // ignore
        }
      }
      setStatus('サインイン成功')
      await fetchRoleAndRedirect()
    } catch (err) {
      setStatus('サインインに失敗しました')
    }
  }

  useEffect(() => {
    // handle case where user returns from OAuth or already signed in
    fetchRoleAndRedirect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>サインイン</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>メールアドレス</label>
          <br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>パスワード</label>
          <br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit">サインイン</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <button onClick={signInWithGoogle}>Googleでサインイン</button>
      </div>
      <p>{status}</p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <SignInPageContent />
    </Suspense>
  )
}
