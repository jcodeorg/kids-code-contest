'use client'

import Link from 'next/link'
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
      setStatus('登録状況を確認中...')
      const checkRes = await fetch('/api/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = await checkRes.json()
      if (!checkRes.ok) {
        setStatus('確認処理でエラー: ' + (checkData?.error || checkRes.status))
        return
      }
      if (checkData?.exists) {
        setStatus('サインアップは既に行われているか、何か問題がある可能性があります。保護者の方で登録状況をご確認ください。')
        return
      }

      setStatus('ユーザー作成中...')
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })

      if (res.error) {
        setStatus('エラー: ' + res.error.message)
        return
      }

      const signUpData = res.data || {}
      const user = signUpData.user
      const session = signUpData.session
      const identities = user?.identities || []

      // Supabase client response does not expose strict delivery status.
      // Use conservative heuristics to avoid false "登録完了" for already-signed-up users.
      const now = Date.now()
      const parseTime = (value: unknown) => {
        if (!value) return null
        if (!(typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
          return null
        }
        const t = new Date(value).getTime()
        return Number.isFinite(t) ? t : null
      }
      const confirmationSentAt = parseTime(user?.confirmation_sent_at)
      const createdAt = parseTime(user?.created_at)
      const hasConfirmedEmail = Boolean(user?.email_confirmed_at)
      const sentRecently = confirmationSentAt !== null && Math.abs(now - confirmationSentAt) <= 3 * 60 * 1000
      const createdRecently = createdAt !== null && Math.abs(now - createdAt) <= 3 * 60 * 1000
      const hasRealIdentity = Array.isArray(identities) && identities.length > 0

      const isConfirmationMailFlow = Boolean(user) && !session && !hasConfirmedEmail && sentRecently && (hasRealIdentity || createdRecently)

      if (!isConfirmationMailFlow) {
        setStatus('サインアップは既に行われているか、何か問題がある可能性があります。保護者の方で登録状況をご確認ください。')
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

      const doneMessage = '登録完了。ご自身のメールに確認リンクを送信しました。メールの確認後にアカウントが利用可能になります。'
      window.alert(doneMessage)
      router.push('/')
      return
    } catch {
      setStatus('送信に失敗しました')
    }
  }

  useEffect(() => {
    // if already signed in (e.g., OAuth), redirect to dashboard
    ;(async () => {
      try {
        const userRes = await supabase.auth.getUser()
        const user = userRes?.data?.user
        if (user?.email) {
          try {
            const sessionRes = await supabase.auth.getSession()
            const accessToken = sessionRes?.data?.session?.access_token || null
            if (accessToken) {
              const rolesRes = await fetch('/api/auth/roles', { headers: { Authorization: `Bearer ${accessToken}` } })
              const rolesData = await rolesRes.json()
              if (rolesRes.ok && rolesData?.current_role_id) {
                router.push(`/${rolesData.current_role_id}`)
                return
              }
            }
          } catch {
            // ignore and continue
          }

          // create profile for OAuth users
          try {
            const { data: existing } = await supabase
              .from('users')
              .select('user_id')
              .eq('user_id', user.id)
              .maybeSingle()
            if (!existing) {
              const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0]
              await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: user.email, inviteToken }) })
            }
          } catch {
            // ignore
          }
          router.push('/applicant')
          return
        }
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">サインアップ</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">氏名</span></div>
              <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">メールアドレス</span></div>
              <input className="input input-bordered w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">パスワード</span></div>
              <input className="input input-bordered w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            <button className="btn btn-primary" type="submit">サインアップ</button>
          </form>

          <p className="text-sm">パスワードを忘れた方は <Link className="link link-primary" href="/auth/forgot-password">こちらから再設定</Link></p>
          <p className="text-xs"><Link className="link" href="/">トップページに戻る</Link></p>

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
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
