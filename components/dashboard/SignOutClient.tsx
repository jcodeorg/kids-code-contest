'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function SignOutClient({ role }: { role: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // ignore
    }
    setLoading(false)
    router.push('/')
  }

  return (
    <div className="card bg-base-100 border border-base-200 mb-4">
      <div className="card-body p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">現在のロール: <strong>{role}</strong></div>
        <button className="btn btn-ghost" onClick={handleSignOut} disabled={loading}>{loading ? 'サインアウト中...' : 'サインアウト'}</button>
      </div>
    </div>
  )
}
