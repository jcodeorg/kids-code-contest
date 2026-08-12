'use client'

import React, { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

function InviteLandingContent() {
  const params = useSearchParams()
  const token = params?.get('token') || ''
  const router = useRouter()

  async function signUpWithGoogle() {
    if (!token) return
    const redirectTo = `${window.location.origin}/auth/callback?token=${encodeURIComponent(token)}`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'online' },
      },
    })
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">招待リンク</h1>
      {token ? (
        <>
          <p className="text-base-content/70">この招待リンクを使って登録すると、特別なロールが付与されます。</p>
          <div className="flex flex-col gap-3">
            <button className="btn w-full flex items-center justify-center gap-2 bg-white text-black border transition-transform duration-150 hover:scale-105 hover:shadow-md active:scale-100" onClick={signUpWithGoogle}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.3h147.1c-6.3 34-25 62.8-53.3 82v68.1h85.9c50.4-46.5 80.8-114.7 80.8-195z"/>
                <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24.1 178.1-65.6l-85.9-68.1c-23.9 16-54.4 25.6-92.2 25.6-70.8 0-130.7-47.8-152-112.2H34.9v70.6C79.4 486.3 167.3 544.3 272 544.3z"/>
                <path fill="#FBBC05" d="M119.9 323.9c-10.9-32.6-10.9-67.7 0-100.3V153h-84.7C8.7 201.9 0 238.4 0 272c0 33.6 8.7 70.1 35.2 119.9l84.7-68z"/>
                <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77C405.6 24.6 347.7 0 272 0 167.3 0 79.4 58 34.9 153l84.7 70.6C141.3 155.5 201.2 107.7 272 107.7z"/>
              </svg>
              <span>Googleで登録</span>
            </button>
            <button className="btn btn-primary w-full flex items-center justify-center gap-2" onClick={() => router.push(`/auth/signup?token=${token}`)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true" focusable="false">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>メールアドレスで登録</span>
            </button>
          </div>
          <div className="pt-2 text-sm text-base-content/70">
            すでにアカウントを持っている方は <button className="link" onClick={() => router.push(`/auth/signin?token=${token}`)}>こちらからサインイン</button>
          </div>
        </>
      ) : (
        <div className="alert alert-warning">招待トークンが無効です。</div>
      )}
        </div>
      </div>
    </div>
  )
}

export default function InviteLanding() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <InviteLandingContent />
    </Suspense>
  )
}
