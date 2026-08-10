import React from 'react'
import DashboardShellClient from '../dashboard/DashboardShellClient'

export default async function RoleDashboard({ params }: { params: Promise<{ role?: string }> | { role?: string } }) {
  const p = await params
  const role = p?.role || 'applicant'
  return <DashboardShellClient paramsRole={role} />
}
