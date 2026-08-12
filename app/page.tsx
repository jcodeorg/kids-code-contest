"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [role, setRole] = useState<string>('applicant')
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      try {
        const r = await supabase.auth.getUser()
        const user = r?.data?.user
        if (user) {
          setSignedIn(true)
          // set a concise status (kept for informational use)
          try {
            const provider = user?.app_metadata?.provider || (user?.app_metadata?.providers && user.app_metadata.providers[0]) || (user?.identities && user.identities[0]?.provider)
            const display = provider ? `${provider}でサインイン中` : `${user.email || 'サインイン中'}でサインイン中`
            setStatus(display)
          } catch {
            setStatus(`${user.email || 'サインイン中'}でサインイン中`)
          }
          // try to load role and name from profile; default values if missing
          try {
            const { data: profile } = await supabase.from('users').select('current_role_id,name').eq('user_id', user.id).single()
            setRole(profile?.current_role_id || 'applicant')
            setUserName(profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || '')
          } catch {
            setRole('applicant')
            setUserName(user.user_metadata?.name || user.email?.split('@')[0] || '')
          }
          return
        }
      } catch {
        // ignore
      }
    })()
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
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('OAuth エラー: ' + message)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        signInWithGoogle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleSignOut() {
    setStatus('サインアウト中...')
    try {
      await supabase.auth.signOut()
      setSignedIn(false)
      router.push('/')
    } catch {
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

          {/* 未サインイン向けの画面は常に表示 */}
          <div className="flex flex-col gap-3">
            <button autoFocus className="btn w-full flex items-center justify-center gap-2 bg-white text-black border transition-transform duration-150 hover:scale-105 hover:shadow-md active:scale-100" onClick={signInWithGoogle}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.3h147.1c-6.3 34-25 62.8-53.3 82v68.1h85.9c50.4-46.5 80.8-114.7 80.8-195z"/>
                <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24.1 178.1-65.6l-85.9-68.1c-23.9 16-54.4 25.6-92.2 25.6-70.8 0-130.7-47.8-152-112.2H34.9v70.6C79.4 486.3 167.3 544.3 272 544.3z"/>
                <path fill="#FBBC05" d="M119.9 323.9c-10.9-32.6-10.9-67.7 0-100.3V153h-84.7C8.7 201.9 0 238.4 0 272c0 33.6 8.7 70.1 35.2 119.9l84.7-68z"/>
                <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77C405.6 24.6 347.7 0 272 0 167.3 0 79.4 58 34.9 153l84.7 70.6C141.3 155.5 201.2 107.7 272 107.7z"/>
              </svg>
              <span>Google でサインイン</span>
            </button>
            <button className="btn btn-outline w-full flex items-center justify-center gap-2" onClick={() => router.push('/auth/signin')}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true" focusable="false">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>メールでサインイン</span>
            </button>
          </div>

          {/* 中央のサインイン状態表示・ダッシュボードボタンは削除 */}

          <p className="text-sm text-base-content/80 mt-2">できるだけ「Google でサインイン」を使おう。そっちのほうがかんたんだよ。Googleを使えない人だけ、メールでサインインしてね。</p>

          {signedIn ? (
            <div className="alert alert-info text-sm flex items-center justify-between">
              <div>役割: {role}　名前: {userName || '—'}</div>
              <button className="link" onClick={handleSignOut}>サインアウト</button>
            </div>
          ) : (
            status ? <div className="alert alert-info text-sm">{status}</div> : null
          )}
        </div>
      </div>
    </main>
  )
}
