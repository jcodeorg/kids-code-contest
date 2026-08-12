import { NextResponse } from 'next/server'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { requireAuthWithRoles } from '../../../lib/auth/request-auth'

export const runtime = 'nodejs'

const ALLOWED_KINDS = ['thumbnail', 'video'] as const

function isAllowedKind(v: string): v is (typeof ALLOWED_KINDS)[number] {
  return ALLOWED_KINDS.includes(v as (typeof ALLOWED_KINDS)[number])
}

function buildPublicUrl(key: string) {
  const publicBase = process.env.R2_PUBLIC_URL?.trim()
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`

  const endpoint = process.env.R2_ENDPOINT?.trim() || ''
  const bucket = process.env.R2_BUCKET_NAME?.trim() || ''
  return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
}

function extractKeyFromUrl(url: string) {
  const raw = url.trim()
  if (!raw) return ''

  const publicBase = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/$/, '') || ''
  if (publicBase && raw.startsWith(`${publicBase}/`)) {
    return raw.slice(publicBase.length + 1)
  }

  const endpoint = process.env.R2_ENDPOINT?.trim()?.replace(/\/$/, '') || ''
  const bucket = process.env.R2_BUCKET_NAME?.trim() || ''
  const endpointWithBucket = endpoint && bucket ? `${endpoint}/${bucket}/` : ''
  if (endpointWithBucket && raw.startsWith(endpointWithBucket)) {
    return raw.slice(endpointWithBucket.length)
  }

  return ''
}

function createR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const endpoint = process.env.R2_ENDPOINT
  if (!accessKeyId || !secretAccessKey || !endpoint) return null

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  })
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const kind = (formData.get('kind') as string) || 'thumbnail'
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (!isAllowedKind(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })

    const bucket = process.env.R2_BUCKET_NAME
    const client = createR2Client()
    if (!bucket || !client) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 })
    }

    if (kind === 'thumbnail' && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'thumbnail must be image/*' }, { status: 400 })
    }
    if (kind === 'video' && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'video must be video/*' }, { status: 400 })
    }

    const filename = file.name || 'upload'
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `uploads/${kind}/${auth.identity.userId}/${Date.now()}-${sanitized}`
    const arrayBuffer = await file.arrayBuffer()
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type || 'application/octet-stream',
    }))

    const url = buildPublicUrl(key)

    return NextResponse.json({ ok: true, url, key })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuthWithRoles(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const targetUrl = typeof body?.url === 'string' ? body.url : ''
    if (!targetUrl) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const key = extractKeyFromUrl(targetUrl)
    if (!key) return NextResponse.json({ error: 'invalid r2 url' }, { status: 400 })

    if (!key.startsWith(`uploads/thumbnail/${auth.identity.userId}/`) && !key.startsWith(`uploads/video/${auth.identity.userId}/`)) {
      return NextResponse.json({ error: 'not allowed' }, { status: 403 })
    }

    const bucket = process.env.R2_BUCKET_NAME
    const client = createR2Client()
    if (!bucket || !client) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 })
    }

    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return NextResponse.json({ ok: true, key })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
