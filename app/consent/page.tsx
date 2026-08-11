import { supabaseAdmin } from '../../lib/supabase/server'
import ApproveClient from './ApproveClient'

type Props = { searchParams?: { token?: string } }

export default async function Page({ searchParams }: Props) {
  // Next.js may provide `searchParams` as a Promise in some runtimes.
  // Await if it's a thenable, otherwise use it directly.
  let params: any = searchParams
  if (params && typeof params.then === 'function') {
    params = await params
  }
  const token = params?.token
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

  // fetch user with the token using admin client
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id, name, name_kana, school_name, grade, email, guardian_email, guardian_name, guardian_phone, guardian_consent')
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

  return (
    <div className="w-full px-4 py-10">
      <div className="max-w-2xl mx-auto card bg-base-100 shadow-xl">
        <div className="card-body gap-5">
          <h1 className="card-title text-2xl">保護者同意ページ</h1>
          <div className="bg-base-200 rounded-box p-4 text-sm leading-relaxed">
            <p>以下の内容を確認・修正のうえ、同意してください。</p>
            <p className="mt-2">個人情報の取り扱い: 本コンテストでは応募に必要な範囲でお子様の氏名・学校名・連絡先を使用します。申請された情報は運営以外には公開しません。</p>
            <p className="mt-3 font-semibold">お子様の情報（保護者が確認・修正できます）</p>
            <p className="mt-2">お子様: <strong>{data.name}</strong></p>
            <p>ふりがな: <strong>{data.name_kana || '-'}</strong></p>
            <p>学校: <strong>{data.school_name || '-'}</strong></p>
            <p>学年: <strong>{data.grade || '-'}</strong></p>
            <p className="mt-2">応募者メール: <strong>{data.email}</strong></p>
            <p>保護者通知先: <strong>{data.guardian_email || '-'}</strong></p>
            <p>保護者氏名: <strong>{data.guardian_name || '-'}</strong></p>
            <p>保護者電話: <strong>{data.guardian_phone || '-'}</strong></p>
          </div>

          <ApproveClient token={token} initialStatus={data.guardian_consent} initialData={data} />
        </div>
      </div>
    </div>
  )
}
