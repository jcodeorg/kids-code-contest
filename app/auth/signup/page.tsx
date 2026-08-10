'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

function SignUpPageContent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [status, setStatus] = useState('')
  const searchParams = useSearchParams()
  const inviteToken = searchParams?.get('token') || ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('送信中...')
    try {
      setStatus('ユーザー作成中...')
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      } as any)

      if (res.error) {
        setStatus('エラー: ' + res.error.message)
        return
      }

      // create profile (guardian email will be collected later from dashboard)
      setStatus('プロファイル作成中...')
      const regRes = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, inviteToken }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) {
        setStatus('登録後処理でエラー: ' + (regData?.error || regRes.status))
        return
      }

      // Inform user to check email for confirmation. Guardian email is optional; if provided, guardian consent email will be sent separately.
      if (regData?.guardianEmailSent) {
        setStatus('登録完了。保護者宛に同意メールを送信しました。まずはご自身のメールの確認をお願いします。')
      } else {
        setStatus('登録完了。ご自身のメールに確認リンクを送信しました。メールの確認後にアカウントが利用可能になります。')
      }
      // do not attempt automatic sign-in here; wait for email confirmation
    } catch (err) {
      setStatus('送信に失敗しました')
    }
  }

  useEffect(() => {
    // if already signed in (e.g., OAuth), redirect to dashboard
    ;(async () => {
      try {
        const userRes: any = await supabase.auth.getUser()
        const user = userRes?.data?.user
        if (user?.email) {
          try {
            const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
            const role = profile?.role || 'applicant'
            router.push(`/${role}`)
            return
          } catch (err) {
            // create profile for OAuth users
            try {
              const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0]
              await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: user.email, inviteToken }) })
            } catch (e) {
              // ignore
            }
            router.push('/applicant')
            return
          }
        }
      } catch (e) {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>サインアップ</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>氏名</label>
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>メールアドレス</label>
          <br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {/* guardianEmail removed: will be requested from applicant dashboard */}
        <div style={{ marginBottom: 8 }}>
          <label>パスワード</label>
          <br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit">サインアップ</button>
      </form>
      <p>{status}</p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <SignUpPageContent />
    </Suspense>
  )
}
