'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [status, setStatus] = useState('')

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

      // create profile and send guardian consent email via server API
      setStatus('プロファイル作成中...')
      const regRes = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, guardianEmail }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) {
        setStatus('登録後処理でエラー: ' + (regData?.error || regRes.status))
        return
      }

      setStatus('登録完了。保護者宛に同意メールを送信しました。')
      // try to sign in automatically (may require email confirmation depending on Supabase settings)
      try {
        await supabase.auth.signInWithPassword({ email, password } as any)
      } catch (e) {
        // ignore sign-in errors; user can still check email
      }
      setTimeout(async () => {
        try {
          const userRes: any = await supabase.auth.getUser()
          const user = userRes?.data?.user
          if (user?.email) {
            const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
            const role = profile?.role || 'applicant'
            router.push(`/dashboard/${role}`)
            return
          }
        } catch (err) {
          // ignore
        }
        router.push('/dashboard/applicant')
      }, 1200)
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
          const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
          const role = profile?.role || 'applicant'
          router.push(`/dashboard/${role}`)
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
        <div style={{ marginBottom: 8 }}>
          <label>保護者のメールアドレス</label>
          <br />
          <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
        </div>
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
