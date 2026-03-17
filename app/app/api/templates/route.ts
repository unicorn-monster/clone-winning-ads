import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ROOT = path.join(process.cwd(), '..')

export async function GET() {
  const refsDir = path.join(ROOT, 'references')
  const entries = await fs.readdir(refsDir, { withFileTypes: true })

  const templates = await Promise.all(
    entries
      .filter(e => e.isDirectory() && e.name.startsWith('template-prompt-'))
      .map(async e => {
        const folderPath = path.join(refsDir, e.name)
        const files = await fs.readdir(folderPath)
        const promptFile = files.find(f => f.startsWith('prompt-'))
        const imgFile = files.find(f => f.match(/\.(png|jpg|jpeg|webp)$/i))

        let adFormat = ''
        let ratio = '1:1'
        let promptBody = ''
        if (promptFile) {
          const raw = await fs.readFile(path.join(folderPath, promptFile), 'utf-8')
          const divider = raw.indexOf('\n---\n')
          if (divider !== -1) {
            for (const line of raw.slice(0, divider).split('\n')) {
              const i = line.indexOf(':')
              if (i === -1) continue
              const key = line.slice(0, i).trim()
              const val = line.slice(i + 1).trim()
              if (key === 'ad-format') adFormat = val
              if (key === 'ratio') ratio = val
            }
            promptBody = raw.slice(divider + 5).trim()
          }
        }

        return {
          folder: e.name,
          adFormat,
          ratio,
          promptBody,
          refImg: imgFile ? `/api/ref-img?folder=${e.name}&file=${imgFile}` : null,
        }
      })
  )

  return NextResponse.json({ templates })
}
