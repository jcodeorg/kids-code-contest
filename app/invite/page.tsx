'use client'

import React, { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function InviteLandingContent() {
  const params = useSearchParams()
  const token = params?.get('token') || ''
  const router = useRouter()

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">招待リンク</h1>
      {token ? (
        <>
          <p className="text-base-content/70">この招待リンクを使って登録すると、特別なロールが付与されます。</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={() => router.push(`/auth/signup?token=${token}`)}>新規登録（メール）</button>
            <button className="btn btn-ghost" onClick={() => router.push(`/auth/signin?token=${token}`)}>サインイン（既存アカウント）</button>
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
