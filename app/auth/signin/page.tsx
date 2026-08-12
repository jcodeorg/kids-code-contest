'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
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
      const redirectTo = inviteToken
        ? `${window.location.origin}/auth/callback?token=${encodeURIComponent(inviteToken)}`
        : `${window.location.origin}/auth/callback`

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { access_type: 'online' },
        },
      })
    } catch (err: unknown) {
      setStatus('OAuth エラー: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function fetchRoleAndRedirect() {
    try {
      const userRes = await supabase.auth.getUser()
      const user = userRes?.data?.user
      if (!user?.email) return

      const sessionRes = await supabase.auth.getSession()
      const accessToken = sessionRes?.data?.session?.access_token || null

      if (accessToken) {
        try {
          const rolesRes = await fetch('/api/auth/roles', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const rolesData = await rolesRes.json()
          if (rolesRes.ok && rolesData?.current_role_id) {
            router.push(`/${rolesData.current_role_id}`)
            return
          }
        } catch {
          // continue fallback
        }
      }

      try {
        const { data: profile } = await supabase
          .from('users')
          .select('current_role_id')
          .eq('user_id', user.id)
          .single()
        const resolvedRole = profile?.current_role_id || 'applicant'
        router.push(`/${resolvedRole}`)
        return
      } catch {
        try {
          const { data: existing } = await supabase
            .from('users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()
          if (!existing) {
            const displayName = user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0]
            await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: displayName, email: user.email, inviteToken }),
            })
          }
        } catch {
          // ignore
        }
        router.push('/applicant')
      }
    } catch {
      router.push('/applicant')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('認証中...')
    try {
      const res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) {
        setStatus('サインイン失敗: ' + res.error.message)
        return
      }

      if (inviteToken) {
        try {
          await fetch('/api/invite/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inviteToken, email }),
          })
        } catch {
          // ignore
        }
      }

      setStatus('サインイン成功')
      await fetchRoleAndRedirect()
    } catch {
      setStatus('サインインに失敗しました')
    }
  }

  useEffect(() => {
    void (async () => {
      await fetchRoleAndRedirect()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">サインイン</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <label className="form-control w-full">
              <div className="label py-2"><span className="label-text">メールアドレス</span></div>
              <input autoFocus className="input input-bordered w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="form-control w-full">
              <div className="label py-2"><span className="label-text">パスワード</span></div>
              <input className="input input-bordered w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            <div className="flex flex-col gap-6">
              <button className="btn btn-primary w-full flex items-center justify-center gap-2" type="submit">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true" focusable="false">
                  <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>メールでサインイン</span>
              </button>
              <hr className="border-t border-base-200 w-full" />

              <button className="btn w-full flex items-center justify-center gap-2 bg-white text-black border transition-transform duration-150 hover:scale-105 hover:shadow-md active:scale-100" type="button" onClick={signInWithGoogle}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5" aria-hidden="true" focusable="false">
                  <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.3h147.1c-6.3 34-25 62.8-53.3 82v68.1h85.9c50.4-46.5 80.8-114.7 80.8-195z"/>
                  <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24.1 178.1-65.6l-85.9-68.1c-23.9 16-54.4 25.6-92.2 25.6-70.8 0-130.7-47.8-152-112.2H34.9v70.6C79.4 486.3 167.3 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.9 323.9c-10.9-32.6-10.9-67.7 0-100.3V153h-84.7C8.7 201.9 0 238.4 0 272c0 33.6 8.7 70.1 35.2 119.9l84.7-68z"/>
                  <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77C405.6 24.6 347.7 0 272 0 167.3 0 79.4 58 34.9 153l84.7 70.6C141.3 155.5 201.2 107.7 272 107.7z"/>
                </svg>
                <span>Google でサインイン</span>
              </button>
            </div>
          </form>

          <p className="text-sm text-base-content/80 mt-4">はじめてメールでサインインする人は、まずメールでサインアップが必要です。保護者の方が先にメールでサインアップの手続きを行ってください。</p>

          <p className="text-sm">
            はじめての方は <Link className="link link-primary" href="/auth/signup">メールでサインアップ</Link>
          </p>

          <p className="text-sm">
            パスワードを忘れた方は <Link className="link link-primary" href="/auth/forgot-password">こちらから再設定</Link>
          </p>

          <p className="text-xs mt-2"><Link className="link" href="/">トップページに戻る</Link></p>

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
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
