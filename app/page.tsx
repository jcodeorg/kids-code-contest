"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [role, setRole] = useState<string>('applicant')

  useEffect(() => {
    ;(async () => {
      try {
        const r: any = await supabase.auth.getUser()
        const user = r?.data?.user
        if (user) {
          setSignedIn(true)
          // show a concise signed-in message and do not navigate away
          try {
            const provider = user?.app_metadata?.provider || (user?.app_metadata?.providers && user.app_metadata.providers[0]) || (user?.identities && user.identities[0]?.provider)
            const display = provider ? `${provider}でサインイン中` : `${user.email || 'サインイン中'}でサインイン中`
            setStatus(display)
          } catch (e) {
            setStatus(`${user.email || 'サインイン中'}でサインイン中`)
          }
          // try to load role from profile; default to applicant
          try {
            const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
            setRole(profile?.role || 'applicant')
          } catch (err) {
            setRole('applicant')
          }
          return
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

      {signedIn ? (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => router.push(`/${role}`)}>ダッシュボードへ</button>
          <button onClick={handleSignOut}>サインアウト</button>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: 20 }}>
            <button onClick={signInWithGoogle}>Googleではじめる</button>
          </section>

          <section style={{ marginBottom: 20 }}>
            <button onClick={() => router.push('/auth/signin')}>メールでサインイン</button>
          </section>
        </>
      )}

      <p style={{ marginTop: 16 }}>{status}</p>
    </main>
  )
}
