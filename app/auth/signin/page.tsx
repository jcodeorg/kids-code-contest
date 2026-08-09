'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')

  async function signInWithGoogle() {
    setStatus('Googleでサインイン中...')
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' } as any)
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
      const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
      const role = profile?.role || 'applicant'
      router.push(`/dashboard/${role}`)
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
