'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

function ForgotPasswordPageContent() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('再設定メールを送信中...')

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setSent(false)
        setStatus('再設定メールの送信に失敗しました: ' + error.message)
        return
      }

      setSent(true)
      setStatus('再設定メールを送信しました。メールのリンクから新しいパスワードを設定してください。')
    } catch {
      setSent(false)
      setStatus('再設定メールの送信に失敗しました。')
    }
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div>
            <h1 className="card-title text-2xl">パスワードを再設定</h1>
            <p className="text-sm text-base-content/80 mt-2">登録したメールアドレスを入力すると、パスワードを設定しなおすためのメールが届きます。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <label className="form-control w-full">
              <div className="label py-2"><span className="label-text">メールアドレス</span></div>
              <input autoFocus className="input input-bordered w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <button className="btn btn-primary w-full" type="submit">再設定メールを送る</button>
          </form>

          <p className="text-sm">サインイン画面へ <Link className="link link-primary" href="/auth/signin">戻る</Link></p>
          <p className="text-xs"><Link className="link" href="/">トップページに戻る</Link></p>

          {status ? (
            <div className={`alert text-sm ${sent ? 'alert-success' : 'alert-info'}`}>
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
      <ForgotPasswordPageContent />
    </Suspense>
  )
}