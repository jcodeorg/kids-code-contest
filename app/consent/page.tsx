import { supabaseAdmin } from '../../lib/supabase/server'
import ApproveClient from './ApproveClient'

type Props = { searchParams?: { token?: string } }

type ConsentSearchParams = { token?: string }

export default async function Page({ searchParams }: Props) {
  // Next.js may provide `searchParams` as a Promise in some runtimes.
  // Await if it's a thenable, otherwise use it directly.
  let params: ConsentSearchParams | Promise<ConsentSearchParams> | undefined = searchParams
  if (params && typeof params === 'object' && 'then' in params && typeof params.then === 'function') {
    params = await params
  }
  const token = (params as ConsentSearchParams | undefined)?.token
  if (!token) {
    return (
      <div className="w-full px-4 py-10">
        <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-2xl">保護者同意ページ</h1>
            <div className="alert alert-warning">トークンが指定されていません。</div>
          </div>
        </div>
      </div>
    )
  }

  // fetch contest entry with the token using admin client
  const { data, error } = await supabaseAdmin
    .from('contest_entries')
    .select('entry_id, contest_id, user_id, school_name, grade, guardian_email, guardian_name, guardian_phone, guardian_consent, name, name_kana, users(name,email)')
    .eq('guardian_consent_token', token)
    .limit(1)
    .single()

  if (error || !data) {
    return (
      <div className="w-full px-4 py-10">
        <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-2xl">保護者同意ページ</h1>
            <div className="alert alert-error">無効なトークンか、該当する登録が見つかりませんでした。</div>
          </div>
        </div>
      </div>
    )
  }

  const userInfo = Array.isArray(data.users) ? data.users[0] : data.users

  const initialData = {
    name: data.name || userInfo?.name || '',
    name_kana: data.name_kana || '',
    school_name: data.school_name,
    grade: data.grade,
    email: userInfo?.email,
    guardian_email: data.guardian_email,
    guardian_name: data.guardian_name,
    guardian_phone: data.guardian_phone,
  }

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <h1 className="card-title text-2xl">個人情報の取り扱いについて</h1>
          <div className="bg-base-200 rounded-box p-4 text-sm leading-relaxed">

            <p className="mt-2">NPO法人プログラミング教育研究所は、提出された個人情報を以下の目的で適切に管理・利用します。</p>

            <p className="mt-4 font-semibold">1. 利用目的</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>連絡、賞状・資料への記載</li>
              <li>会場での氏名・学校名・作品紹介の掲示</li>
              <li>HP・広報紙等での作品・受賞者紹介</li>
              <li>写真・動画の記録・広報利用</li>
            </ul>

            <p className="mt-4 font-semibold">2. 第三者提供</p>
            <p className="mt-2">北区教育委員会および北区立小中学校へ、以下を提供します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>氏名、学校名、学年、作品情報</li>
              <li>コンテスト時の写真・動画</li>
            </ul>
            <p className="mt-2">提供先でも上記目的の範囲で利用します。</p>

          </div>

          <ApproveClient token={token} initialStatus={data.guardian_consent} initialData={initialData} />
        </div>
      </div>
    </div>
  )
}
