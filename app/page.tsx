"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const r: any = await supabase.auth.getUser()
        const user = r?.data?.user
        if (user) {
          setSignedIn(true)
          try {
            const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
            const role = profile?.role || 'applicant'
            router.push(`/dashboard/${role}`)
            return
          } catch (e) {
            // ignore and stay
          }
        }
      } catch (e) {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signInWithGoogle() {
    setStatus('Google にリダイレクトしています...')
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
    } catch (e: any) {
      setStatus('OAuth エラー: ' + (e?.message || String(e)))
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setStatus('サインイン中...')
    try {
      const res: any = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword } as any)
      if (res.error) {
        setStatus('エラー: ' + res.error.message)
        return
      }
      // on success, redirect to dashboard based on role
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

  async function handleSignOut() {
    setStatus('サインアウト中...')
    try {
      await supabase.auth.signOut()
      setSignedIn(false)
      router.push('/')
    } catch (e) {
      setStatus('サインアウトに失敗しました')
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>北区こどもプログラミングコンテスト</h1>

      {signedIn && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={handleSignOut}>サインアウト</button>
        </div>
      )}

      <section style={{ marginBottom: 20 }}>
        <button onClick={signInWithGoogle}>Google で続行</button>
      </section>

      <section style={{ marginBottom: 20 }}>
        <form onSubmit={handleEmailSignIn}>
          <div style={{ marginBottom: 8 }}>
            <label>メール</label>
            <br />
            <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>パスワード</label>
            <br />
            <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)} required />
          </div>
          <button type="submit">サインイン</button>
        </form>
      </section>

      <section>
        <button onClick={() => router.push('/auth/signup')}>メールで新規登録</button>
      </section>

      <p style={{ marginTop: 16 }}>{status}</p>
    </main>
  )
}
