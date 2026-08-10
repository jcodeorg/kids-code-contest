'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import DashboardShellClient from './DashboardShellClient'

export default function RoleGuardClient({ roleParam }: { roleParam: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const userRes: any = await supabase.auth.getUser()
        const user = userRes?.data?.user
        if (!user?.email) {
          if (!mounted) return
          setMessage('サインインしてください')
          setAuthorized(false)
          setLoading(false)
          return
        }

        const { data: profile, error } = await supabase.from('users').select('role').eq('email', user.email).single()
        if (error || !profile) {
          if (!mounted) return
          setMessage('プロフィールが見つかりません')
          setAuthorized(false)
          setLoading(false)
          return
        }

        if (profile.role === roleParam) {
          if (!mounted) return
          setAuthorized(true)
          setLoading(false)
          return
        }

        // role mismatch
        if (!mounted) return
        setMessage('このページを表示する権限がありません')
        setAuthorized(false)
      } catch (e) {
        if (!mounted) return
        setMessage('エラーが発生しました')
        setAuthorized(false)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [roleParam, router])

  if (loading) return <div style={{ padding: 24 }}>読み込み中...</div>

  if (authorized) return <DashboardShellClient paramsRole={roleParam} />

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h2>アクセス不可</h2>
      <p>{message}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => router.push('/auth/signin')}>サインイン</button>
        <button onClick={() => router.push('/')}>トップへ戻る</button>
      </div>
    </div>
  )
}
