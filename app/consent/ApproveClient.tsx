'use client'

import { useState } from 'react'

export default function ApproveClient({ token, initialStatus }: { token: string; initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function approve() {
    setLoading(true)
    setMessage('送信中...')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('approved')
        setMessage('同意が完了しました。ご協力ありがとうございます。')
      } else {
        setMessage('エラー: ' + (data?.error || res.status))
      }
    } catch (err) {
      setMessage('送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p>現在のステータス: {status}</p>
      <button onClick={approve} disabled={loading || status === 'approved'}>
        {status === 'approved' ? '同意済み' : '同意する'}
      </button>
      <p>{message}</p>
    </div>
  )
}
