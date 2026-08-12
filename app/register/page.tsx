'use client'

import { useState } from 'react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [status, setStatus] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('送信中...')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, guardianEmail }),
      })
      if (res.ok) {
        setStatus('登録完了。保護者宛に同意メールを送信しました。')
      } else {
        const data = await res.json()
        setStatus('エラー: ' + (data?.error || res.status))
      }
    } catch {
      setStatus('送信に失敗しました')
    }
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">ユーザー登録</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">お子様氏名（任意）</span></div>
              <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">お子様のメールアドレス</span></div>
              <input className="input input-bordered w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">保護者のメールアドレス</span></div>
              <input className="input input-bordered w-full" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
            </label>

            <button className="btn btn-primary" type="submit">登録して保護者へ同意メールを送る</button>
          </form>

          {status ? <div className="alert alert-info text-sm">{status}</div> : null}
        </div>
      </div>
    </div>
  )
}
