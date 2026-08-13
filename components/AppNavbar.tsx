'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NAV_ITEMS, ROLE_LABELS } from '../config/navigation'
import { supabase } from '../lib/supabase/client'

type RoleResponse = {
  current_role_id?: string
  assigned_role_ids?: string[]
}

export default function AppNavbar() {
  const router = useRouter()
  const pathname = usePathname() || '/'

  const [signedIn, setSignedIn] = useState(false)
  const [userName, setUserName] = useState('ゲスト')
  const [currentRole, setCurrentRole] = useState('applicant')
  const [assignedRoles, setAssignedRoles] = useState<string[]>(['applicant'])
  const [busy, setBusy] = useState(false)

  const pathRole = pathname.split('/').filter(Boolean)[0]
  const validRoleNames = new Set(['applicant', 'staff', 'staff_primary', 'staff_manager', 'judge', 'contest_admin', 'admin'])
  const effectiveRole = pathRole && validRoleNames.has(pathRole) ? pathRole : null
  const navItems = effectiveRole ? NAV_ITEMS[effectiveRole] ?? [] : []

  async function getAccessToken() {
    const sessionRes = await supabase.auth.getSession()
    return sessionRes.data.session?.access_token || null
  }

  async function loadHeaderState() {
    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (!user) {
      setSignedIn(false)
      setUserName('ゲスト')
      setCurrentRole('applicant')
      setAssignedRoles(['applicant'])
      return
    }

    setSignedIn(true)
    const fallbackName = user.user_metadata?.name || user.email?.split('@')[0] || 'ユーザー'
    setUserName(fallbackName)

    try {
      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('user_id', user.id)
        .single()
      if (profile?.name) setUserName(profile.name)
    } catch {
      // noop
    }

    const accessToken = await getAccessToken()
    if (!accessToken) return

    const rolesRes = await fetch('/api/auth/roles', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!rolesRes.ok) return

    const roleData: RoleResponse = await rolesRes.json()
    const nextRole = roleData.current_role_id || 'applicant'
    const nextAssigned = Array.isArray(roleData.assigned_role_ids) && roleData.assigned_role_ids.length > 0
      ? roleData.assigned_role_ids
      : [nextRole]

    setCurrentRole(nextRole)
    setAssignedRoles(nextAssigned)
  }

  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (mounted) {
        void loadHeaderState()
      }
    }, 0)

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        void loadHeaderState()
      }
    })

    return () => {
      mounted = false
      clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRoleSwitch(nextRole: string) {
    if (!signedIn || !nextRole || nextRole === currentRole) return

    setBusy(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        router.push('/auth/signin')
        return
      }

      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role_id: nextRole }),
      })

      const data = await res.json()
      if (!res.ok) return

      const targetRole = data?.current_role_id || nextRole
      setCurrentRole(targetRole)
      router.push(`/${targetRole}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await supabase.auth.signOut()
      setSignedIn(false)
      router.push('/')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { access_type: 'online' },
        },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="w-full border-b border-[#3f84e8] bg-[#4D96FF] text-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          {navItems.length > 0 ? (
            <div className="dropdown dropdown-start lg:hidden">
              <button tabIndex={0} type="button" className="btn btn-sm border-white/30 bg-white/10 text-white hover:bg-white/20" aria-label="メニューを開く">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <ul tabIndex={0} className="menu dropdown-content z-50 mt-2 w-64 rounded-box bg-base-100 p-2 text-base-content shadow-lg">
                {navItems.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link href="/" className="shrink-0 text-2xl font-extrabold tracking-tight text-[#ffb020]">
            コンテスト
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden items-center gap-2 lg:flex" aria-label="メインナビゲーション">
              {navItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="btn btn-sm border-white/30 bg-white/15 text-white hover:bg-white/25" disabled={busy}>
              {signedIn ? (
                <>
                  <span className="max-w-[8rem] truncate font-semibold">{userName}</span>
                  <span className="hidden text-xs opacity-85 sm:inline">{ROLE_LABELS[currentRole] || currentRole}</span>
                </>
              ) : (
                <span className="font-semibold">サインイン</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-90" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            <ul tabIndex={0} className="menu dropdown-content z-50 mt-2 w-64 rounded-box bg-base-100 p-2 text-base-content shadow-lg">
              {signedIn ? (
                <>
                  <li className="menu-title"><span>ロール切替</span></li>
                  {assignedRoles.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        className={r === currentRole ? 'active' : ''}
                        onClick={() => handleRoleSwitch(r)}
                        disabled={busy || r === currentRole}
                      >
                        {ROLE_LABELS[r] || r}
                      </button>
                    </li>
                  ))}
                  <li className="menu-title"><span>アカウント</span></li>
                  <li>
                    <button type="button" onClick={handleSignOut} disabled={busy} className="text-error">
                      サインアウト
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button type="button" onClick={handleGoogleSignIn} disabled={busy}>Googleでサインイン</button>
                  </li>
                  <li>
                    <Link href="/auth/signin">メールでサインイン</Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </header>
  )
}
