'use client'

import React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function InviteLanding() {
  const params = useSearchParams()
  const token = params?.get('token') || ''
  const router = useRouter()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 16 }}>
      <h1>招待リンク</h1>
      {token ? (
        <>
          <p>この招待リンクを使って登録すると、特別なロールが付与されます。</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push(`/auth/signup?token=${token}`)}>新規登録（メール）</button>
            <button onClick={() => router.push(`/auth/signin?token=${token}`)}>サインイン（既存アカウント）</button>
          </div>
        </>
      ) : (
        <p>招待トークンが無効です。</p>
      )}
    </div>
  )
}
