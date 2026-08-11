'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

function ResetPasswordPageContent() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const hash = window.location.hash || ''
      if (hash.includes('type=recovery') || hash.includes('access_token=')) {
        if (mounted) setRecoveryReady(true)
      }

      const { data } = await supabase.auth.getSession()
      if (data.session && mounted) {
        setRecoveryReady(true)
      }
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (mounted) setRecoveryReady(true)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      setStatus('パスワードは6文字以上で入力してください。')
      return
    }

    if (password !== confirmPassword) {
      setStatus('確認用パスワードが一致しません。')
      return
    }

    setStatus('新しいパスワードを保存中...')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setStatus('パスワードの更新に失敗しました: ' + error.message)
        return
      }

      setStatus('パスワードを更新しました。サインイン画面へ移動します。')
      router.push('/auth/signin')
    } catch {
      setStatus('パスワードの更新に失敗しました。')
    }
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div>
            <h1 className="card-title text-2xl">新しいパスワードを設定</h1>
            <p className="text-sm text-base-content/80 mt-2">メールのリンクを開いたあとで、新しいパスワードを2回入力してください。</p>
          </div>

          {recoveryReady ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <label className="form-control w-full">
                <div className="label py-2"><span className="label-text">新しいパスワード</span></div>
                <input autoFocus className="input input-bordered w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>

              <label className="form-control w-full">
                <div className="label py-2"><span className="label-text">新しいパスワード（確認）</span></div>
                <input className="input input-bordered w-full" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </label>

              <button className="btn btn-primary w-full" type="submit">パスワードを更新する</button>
            </form>
          ) : (
            <div className="alert alert-info text-sm">メールの再設定リンクからこのページを開いてください。リンクを開いても表示されない場合は、もう一度再設定メールを送ってください。</div>
          )}

          <p className="text-sm">再設定メールが必要な場合は <Link className="link link-primary" href="/auth/forgot-password">こちら</Link></p>
          <p className="text-xs"><Link className="link" href="/auth/signin">サインイン画面に戻る</Link></p>

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}