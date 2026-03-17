import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ROOT = path.join(process.cwd(), '..')

export async function GET() {
  const productsDir = path.join(ROOT, 'products')
  try {
    const entries = await fs.readdir(productsDir, { withFileTypes: true })
    const slugs = entries.filter(e => e.isDirectory()).map(e => e.name)
    return NextResponse.json({ products: slugs })
  } catch {
    return NextResponse.json({ products: [] })
  }
}
