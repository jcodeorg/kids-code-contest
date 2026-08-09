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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <h1>保護者同意ページ</h1>
        <p>トークンが指定されていません。</p>
      </div>
    )
  }

  // fetch user with the token using admin client
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id, name, email, guardian_email, guardian_consent')
    .eq('guardian_consent_token', token)
    .limit(1)
    .single()

  if (error || !data) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <h1>保護者同意ページ</h1>
        <p>無効なトークンか、該当する登録が見つかりませんでした。</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>保護者同意ページ</h1>
      <p>
        以下の内容で同意しますか？ <br />
        お子様: {data.name} <br />
        応募者メール: {data.email} <br />
        保護者通知先: {data.guardian_email}
      </p>

      <ApproveClient token={token} initialStatus={data.guardian_consent} />
    </div>
  )
}
