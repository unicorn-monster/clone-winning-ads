import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function POST(req: NextRequest) {
  const { images } = await req.json() as { images: { url: string; filename: string }[] }

  if (!images?.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  const zip = new JSZip()

  await Promise.all(
    images.map(async ({ url, filename }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${url}`)
      const buffer = await res.arrayBuffer()
      zip.file(filename, buffer)
    })
  )

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="ads.zip"',
    },
  })
}
