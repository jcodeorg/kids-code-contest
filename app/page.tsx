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
          // Avoid forcing Google consent/account confirmation every time.
          queryParams: { access_type: 'online' },
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
    <main className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div>
            <h1 className="card-title text-3xl">北区こどもプログラミングコンテスト</h1>
            <p className="text-sm text-base-content/70 mt-2">安全なサインインで、応募・審査・運営の各ダッシュボードへアクセスできます。</p>
          </div>

          {signedIn ? (
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={() => router.push(`/${role}`)}>ダッシュボードへ</button>
              <button className="btn btn-ghost" onClick={handleSignOut}>サインアウト</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="btn btn-primary" onClick={signInWithGoogle}>Googleではじめる</button>
              <button className="btn btn-outline" onClick={() => router.push('/auth/signin')}>メールでサインイン</button>
            </div>
          )}

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
    </main>
  )
}
