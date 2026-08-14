'use client'

import { useState } from 'react'

type InitialData = {
  user_id?: string
  name?: string
  name_kana?: string
  school_name?: string
  grade?: string
  email?: string
  guardian_email?: string
  guardian_name?: string
  guardian_phone?: string
}

export default function ApproveClient({ token, initialStatus, initialData }: { token: string; initialStatus?: string; initialData?: InitialData }) {
  const [status, setStatus] = useState(initialStatus || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [name, setName] = useState(initialData?.name || '')
  const [nameKana, setNameKana] = useState(initialData?.name_kana || '')
  const [schoolName, setSchoolName] = useState(initialData?.school_name || '')
  const [grade, setGrade] = useState(initialData?.grade || '')
  const [guardianEmail, setGuardianEmail] = useState(initialData?.guardian_email || '')
  const [guardianName, setGuardianName] = useState(initialData?.guardian_name || '')
  const [guardianPhone, setGuardianPhone] = useState(initialData?.guardian_phone || '')

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function isValidPhone(p: string) {
    return /^[-0-9() 　]{6,20}$/.test(p)
  }

  async function approve() {
    if (!name.trim() || !nameKana.trim() || !schoolName.trim() || !grade.trim() || !guardianEmail.trim() || !guardianName.trim() || !guardianPhone.trim()) {
      setMessage('すべての項目を入力してください')
      return
    }
    if (!isValidEmail(guardianEmail)) {
      setMessage('保護者メールの書き方を確認してください')
      return
    }
    if (!isValidPhone(guardianPhone)) {
      setMessage('電話番号の書き方を確認してください')
      return
    }

    setLoading(true)
    setMessage('送信中...')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, nameKana, schoolName, grade, guardianName, guardianPhone, guardianEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('approved')
        setMessage('同意が完了しました。ご協力ありがとうございます。')
      } else {
        setMessage('エラー: ' + (data?.error || res.status))
      }
    } catch {
      setMessage('送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">

      <div className="rounded-box bg-base-200 p-4 text-sm">
        <p><strong>上記の個人情報の取り扱いに同意します。</strong></p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <label className="form-control">
          <div className="label"><span className="label-text">お子様の名前</span></div>
          <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">ふりがな</span></div>
          <input className="input input-bordered" value={nameKana} onChange={(e) => setNameKana(e.target.value)} required />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">学校名</span></div>
          <input className="input input-bordered" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">学年</span></div>
          <select className="select select-bordered" value={grade} onChange={(e) => setGrade(e.target.value)} required>
            <option value="">えらんでください</option>
            <option value="小1">小1</option>
            <option value="小2">小2</option>
            <option value="小3">小3</option>
            <option value="小4">小4</option>
            <option value="小5">小5</option>
            <option value="小6">小6</option>
            <option value="中1">中1</option>
            <option value="中2">中2</option>
            <option value="中3">中3</option>
          </select>
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">保護者氏名</span></div>
          <input className="input input-bordered" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">保護者の電話番号</span></div>
          <input className="input input-bordered" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="例: 090-1234-5678" required />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">保護者メール</span></div>
          <input className="input input-bordered" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
        </label>
      </div>

      <button className="btn btn-primary" onClick={approve} disabled={loading}>
        {status === 'approved' ? '同意して送信する' : '同意して送信する'}
      </button>

      {message ? <div className="alert alert-info text-sm">{message}</div> : null}
    </div>
  )
}
