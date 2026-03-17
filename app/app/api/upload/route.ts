import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: { dataUri: string; name: string }[] }

  const cloud = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const results = await Promise.all(
    files.map(async ({ dataUri }) => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const folder = 'ad-studio-refs'
      const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
      const signature = crypto.createHash('sha1').update(toSign).digest('hex')

      const body = new URLSearchParams({
        file: dataUri,
        api_key: apiKey,
        timestamp,
        folder,
        signature,
      })

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      const data = await res.json()
      if (!data.secure_url) {
        console.error('Cloudinary error:', JSON.stringify(data))
        return { error: data.error?.message ?? 'Upload failed' }
      }
      return { url: data.secure_url as string }
    })
  )

  const urls = results.filter(r => 'url' in r).map(r => (r as { url: string }).url)
  const errors = results.filter(r => 'error' in r).map(r => (r as { error: string }).error)
  return NextResponse.json({ urls, errors })
}
