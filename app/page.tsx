"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState('')

  // sign in with Google
  async function signInWithGoogle() {
    setStatus('Google にリダイレクトしています...')
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' } as any)
    } catch (e: any) {
      setStatus('OAuth エラー: ' + (e?.message || String(e)))
    }
  }

  // email sign-in
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setStatus('サインイン中...')
    try {
      const res: any = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword } as any)
      if (res.error) {
        setStatus('エラー: ' + res.error.message)
        return
      }
      // fetch role and redirect
      const userRes: any = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (user?.email) {
        const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
        const role = profile?.role || 'applicant'
        router.push(`/dashboard/${role}`)
        return
      }
      router.push('/dashboard/applicant')
    } catch (err) {
      setStatus('サインイン失敗')
    }
  }

  // email sign-up
  const [suName, setSuName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suGuardian, setSuGuardian] = useState('')
  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setStatus('アカウント作成中...')
    try {
      const res: any = await supabase.auth.signUp({ email: suEmail, password: suPassword, options: { data: { name: suName } } } as any)
      if (res.error) {
        setStatus('エラー: ' + res.error.message)
        return
      }
      // create profile and send guardian consent
      const regRes = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: suName, email: suEmail, guardianEmail: suGuardian }) })
      if (!regRes.ok) {
        const d = await regRes.json().catch(() => ({}))
        setStatus('登録後処理でエラー: ' + (d?.error || regRes.status))
        return
      }
      setStatus('登録完了。ダッシュボードへリダイレクトします...')
      // try to sign in and redirect
      try { await supabase.auth.signInWithPassword({ email: suEmail, password: suPassword } as any) } catch {}
      const userRes: any = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (user?.email) {
        const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
        const role = profile?.role || 'applicant'
        router.push(`/dashboard/${role}`)
        return
      }
      router.push('/dashboard/applicant')
    } catch (err) {
      setStatus('サインアップ失敗')
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>北区こどもプログラミングコンテスト</h1>
      <p>簡単にサインイン/サインアップできます。Google またはメールでどうぞ。</p>

      <section style={{ marginBottom: 24 }}>
        <h2>Google でサインイン / サインアップ</h2>
        <button onClick={signInWithGoogle}>Google で続行</button>
      </section>

      <section style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h3>メールでサインイン</h3>
          <form onSubmit={handleEmailSignIn}>
            <div>
              <label>メール</label>
              <br />
              <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} required />
            </div>
            <div>
              <label>パスワード</label>
              <br />
              <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)} required />
            </div>
            <button type="submit">サインイン</button>
          </form>
        </div>

        <div style={{ flex: 1 }}>
          <h3>メールでサインアップ</h3>
          <form onSubmit={handleEmailSignUp}>
            <div>
              <label>氏名</label>
              <br />
              <input value={suName} onChange={(e) => setSuName(e.target.value)} />
            </div>
            <div>
              <label>メール</label>
              <br />
              <input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} required />
            </div>
            <div>
              <label>保護者メール</label>
              <br />
              <input type="email" value={suGuardian} onChange={(e) => setSuGuardian(e.target.value)} required />
            </div>
            <div>
              <label>パスワード</label>
              <br />
              <input type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} required />
            </div>
            <button type="submit">サインアップ</button>
          </form>
        </div>
      </section>

      <p>{status}</p>

      <hr />
      <ul>
        <li>
          <Link href="/auth/signup">別のサインアップページへ</Link>
        </li>
        <li>
          <Link href="/auth/signin">別のサインインページへ</Link>
        </li>
      </ul>
    </main>
  )
}
