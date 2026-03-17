import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  const res = await fetch(
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
    { headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` } }
  )
  const data = await res.json()
  const state = data.data?.state ?? null
  let imageUrl: string | null = null
  try {
    const result = JSON.parse(data.data?.resultJson ?? 'null')
    imageUrl = result?.resultUrls?.[0] ?? null
  } catch {}
  return NextResponse.json({ status: state, imageUrl })
}
