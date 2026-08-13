'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminPanel from './admin/AdminPanel'
import ApplicantGuardianPanel from './ApplicantGuardianPanel'
import ApplicantContestPanel from './contest/ApplicantContestPanel'
import ReviewPanel from './contest/ReviewPanel'
import ContestAdminJudgingPanel from './contest/ContestAdminJudgingPanel'

export default function DashboardShellClient({ paramsRole }: { paramsRole?: string }) {
  const pathname = usePathname() || ''
  const parts = pathname.split('/').filter(Boolean)
  const validRoleNames = new Set(['applicant', 'staff', 'staff_primary', 'staff_manager', 'judge', 'contest_admin', 'admin'])
  const rootRole = parts[0] && validRoleNames.has(parts[0]) ? parts[0] : ''
  const feature = parts[1] || ''
  const role = rootRole || paramsRole || 'applicant'
  const [allContests, setAllContests] = useState<Array<{ contest_id: number; title: string; year: number; status: string }>>([])
  const [selectedApplicantContestId, setSelectedApplicantContestId] = useState<number | null>(null)

  useEffect(() => {
    async function loadContestState() {
      try {
        const res = await fetch('/api/contests')
        if (!res.ok) return
        const data = await res.json()
        const contests = Array.isArray(data?.contests) ? data.contests : []
        setAllContests(contests)

        const activeContest = data?.active_contest
        const nextSelectedId = activeContest?.contest_id ?? contests[0]?.contest_id ?? null
        if (nextSelectedId) {
          setSelectedApplicantContestId((current) => current ?? nextSelectedId)
        }
      } catch {
        setAllContests([])
      }
    }

    void loadContestState()
  }, [role])

  const titleMap: Record<string, string> = {
    applicant: '応募者ダッシュボード',
    staff: '一次採点スタッフダッシュボード',
    contest_admin: 'コンテスト管理者ダッシュボード',
    staff_primary: '一次採点スタッフダッシュボード',
    staff_manager: '集計管理スタッフダッシュボード',
    judge: '審査員ダッシュボード',
    admin: '管理者ダッシュボード',
  }
  const selectedContestName = allContests.find((contest) => contest.contest_id === selectedApplicantContestId)?.title || 'コンテスト未選択'
  const title = allContests.length > 0 ? selectedContestName : (titleMap[role] || `${role} ダッシュボード`)

  const roleSections: Record<string, { title: string; content: React.ReactNode }[]> = {
    applicant: [
      { title: '応募者情報と保護者同意', content: <ApplicantGuardianPanel selectedContestId={selectedApplicantContestId} /> },
      { title: '作品ライブラリと応募', content: <ApplicantContestPanel contests={allContests} selectedContestId={selectedApplicantContestId} onSelectedContestIdChange={setSelectedApplicantContestId} /> },
      { title: '提出状況', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><p>応募開始前・審査中・結果待ちの管理状況をここに表示します。</p></div></div> },
    ],
    staff: [
      { title: '私の審査', content: <ReviewPanel phase="primary" roleLabel="私の審査" /> },
      { title: '応募作品一覧', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">応募作品一覧</h3><p className="text-base-content/70">一次審査対象の作品一覧を確認し、候補作品を絞り込みます。</p><ul className="list-disc pl-5 text-sm text-base-content/80 mt-3"><li>作品タイトル・学校名を確認</li><li>審査対象の候補を整理</li><li>一次通過候補を見極める</li></ul></div></div> },
      { title: '一次集計', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">一次集計</h3><p className="text-base-content/70">審査平均・通過率・候補の偏りを確認して、最終審査の前提を整理します。</p></div></div> },
    ],
    staff_primary: [
      { title: '私の審査', content: <ReviewPanel phase="primary" roleLabel="私の審査" /> },
      { title: '応募作品一覧', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">応募作品一覧</h3><p className="text-base-content/70">一次審査対象の作品一覧を確認し、候補作品を整理します。</p></div></div> },
      { title: '一次集計', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">一次集計</h3><p className="text-base-content/70">一次審査の評価状況と進捗を確認できます。</p></div></div> },
    ],
    staff_manager: [
      { title: '私の審査', content: <ReviewPanel phase="primary" roleLabel="一次審査の確認" /> },
      { title: '応募作品一覧', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">応募作品一覧</h3><p className="text-base-content/70">一次審査中の応募作品の進行状況と候補数を管理します。</p></div></div> },
      { title: '一次集計', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">一次集計</h3><p className="text-base-content/70">通過予定人数・平均点・審査の偏りを見て集計を調整します。</p></div></div> },
    ],
    judge: [
      { title: '私の審査', content: <ReviewPanel phase="final" roleLabel="私の審査" /> },
      { title: '上位作品一覧', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">上位作品一覧</h3><p className="text-base-content/70">一次通過作品の中から、最終審査対象の上位候補を確認します。</p></div></div> },
      { title: '二次集計', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">二次集計</h3><p className="text-base-content/70">最終評価の平均点と順位の整合性を確認します。</p></div></div> },
    ],
    contest_admin: [
      { title: 'コンテスト管理', content: <ContestAdminJudgingPanel /> },
      { title: '一次集計', content: <ReviewPanel phase="primary" roleLabel="一次集計" /> },
      { title: '二次集計', content: <ReviewPanel phase="final" roleLabel="二次集計" /> },
    ],
    admin: [
      { title: 'ユーザー管理', content: <AdminPanel /> },
      { title: 'システム管理', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><h3 className="card-title text-lg">システム管理</h3><p className="text-base-content/70">システム設定・通知・アクセス制御などを管理します。</p></div></div> },
    ],
  }

  const featureMap: Record<string, Record<string, number[]>> = {
    staff: {
      submissions: [1],
      aggregate: [2],
    },
    judge: {
      top_submissions: [1],
      aggregate: [2],
    },
    contest_admin: {
      aggregate_1: [1],
      aggregate_2: [2],
    },
    admin: {
      system: [1],
      users: [0],
    },
  }

  const matchedFeatureSection = feature && role in featureMap && feature in featureMap[role]
    ? featureMap[role][feature].map((index) => roleSections[role][index]).filter(Boolean)
    : null

  const rootSection = roleSections[role]?.[0]
    ? [roleSections[role][0]]
    : [{ title: 'ダッシュボード', content: <div className="card bg-base-100 shadow-md border border-base-200"><div className="card-body"><p>ここは <strong>{role}</strong> 向けのダッシュボードです。</p><p className="text-base-content/70">必要なウィジェットやリンクをここに追加してください。</p></div></div> }]

  const applicantRootSections = role === 'applicant' ? roleSections.applicant || rootSection : rootSection
  const currentSections = matchedFeatureSection || (!feature ? applicantRootSections : roleSections[role] || rootSection)

  return (
    <div className="w-full px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          {allContests.length > 0 ? (
            <div className="relative max-w-4xl">
              <select
                className="w-full appearance-none rounded-2xl border border-base-300 bg-base-100 px-4 py-3 pr-12 text-xl font-bold text-base-content shadow-sm transition focus:border-primary focus:outline-none sm:text-2xl"
                value={selectedApplicantContestId ?? ''}
                onChange={(event) => setSelectedApplicantContestId(event.target.value ? Number(event.target.value) : null)}
                aria-label="コンテスト選択"
              >
                {allContests.map((contest) => (
                  <option key={contest.contest_id} value={contest.contest_id}>{contest.title}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base-content/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          ) : (
            <h1 className="text-3xl font-bold">{title}</h1>
          )}
        </div>
        <div className="space-y-6">
          {currentSections.map((section) => (
            <div key={section.title}>{section.content}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
