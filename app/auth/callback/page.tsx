'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const errorDescription = params.get('error_description')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('OAuth exchange failed', exchangeError)
            if (active) router.replace('/auth/signin')
            return
          }
        } else if (errorDescription) {
          console.error('OAuth callback error', errorDescription)
          if (active) router.replace('/auth/signin')
          return
        }

        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          if (active) router.replace('/auth/signin')
          return
        }

        const user = session?.user
        if (user?.email) {
          try {
            await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0], email: user.email, authProvider: 'google' }),
            })
          } catch (e) {
            // ignore and continue
          }
          if (active) router.replace('/dashboard/applicant')
          return
        }
      } catch (e) {
        console.error('Auth callback failed', e)
      }

      if (active) router.replace('/auth/signin')
    })()

    return () => {
      active = false
    }
  }, [router])

  return <div style={{ padding: 24 }}>認証を処理しています...</div>
}
