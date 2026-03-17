import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ROOT = path.join(process.cwd(), '..')

export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get('folder')
  const file = req.nextUrl.searchParams.get('file')
  if (!folder || !file) return new NextResponse('Missing params', { status: 400 })

  const filePath = path.join(ROOT, 'references', folder, file)
  const buf = await fs.readFile(filePath)
  const ext = path.extname(file).toLowerCase().replace('.', '')
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
  return new NextResponse(buf, { headers: { 'Content-Type': mime } })
}
