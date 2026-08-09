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
    router.push('/auth/signin')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div>現在のロール: <strong>{role}</strong></div>
      <div>
        <button onClick={handleSignOut} disabled={loading}>{loading ? 'サインアウト中...' : 'サインアウト'}</button>
      </div>
    </div>
  )
}
