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
    } catch (err) {
      setStatus('送信に失敗しました')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>ユーザー登録</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>お子様氏名（任意）</label>
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>お子様のメールアドレス</label>
          <br />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>保護者のメールアドレス</label>
          <br />
          <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
        </div>

        <button type="submit">登録して保護者へ同意メールを送る</button>
      </form>
      <p>{status}</p>
    </div>
  )
}
