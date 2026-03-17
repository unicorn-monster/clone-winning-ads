import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const KIE_BASE = 'https://api.kie.ai/api/v1'
const ROOT = path.join(process.cwd(), '..')

const SYSTEM_PROMPT = `You are a DTC ad creative director. Fill every [PLACEHOLDER] in the template using real content from the provided docs.

Rules:
- Source everything from brand-dna.md and product context files — never invent
- If something is not in the docs: flag it as [NOT FOUND IN DOCS: best inference]
- Keep template structure exactly — only replace [PLACEHOLDERS]
- When multiple options exist: pick the most specific, emotional, shortest
- Output ONLY the completed prompt — no explanation, no preamble`

export async function POST(req: NextRequest) {
  const {
    templateFolders,
    productSlug,
    model = 'claude-haiku-4-5-20251001',
    imageUrls,
    filledPrompts, // optional: Record<folder, filledPrompt> — skips Claude step
  } = await req.json()

  const refsDir = path.join(ROOT, 'references')

  // Only load product context if we need to fill any prompts via Claude
  let productContext = ''
  const needsClaude = templateFolders.some((f: string) => !filledPrompts?.[f])
  if (needsClaude) {
    const productDir = path.join(ROOT, 'products', productSlug)
    const productFiles = await fs.readdir(productDir)
    productContext = (
      await Promise.all(
        productFiles
          .filter(f => f.endsWith('.md'))
          .map(async f => `### ${f}\n${await fs.readFile(path.join(productDir, f), 'utf-8')}`)
      )
    ).join('\n\n---\n\n')
  }

  const jobs = await Promise.all(
    templateFolders.map(async (folder: string) => {
      try {
        const folderPath = path.join(refsDir, folder)
        const files = await fs.readdir(folderPath)
        const promptFile = files.find(f => f.startsWith('prompt-'))
        if (!promptFile) return { folder, error: 'No prompt file found' }

        const { meta, rawPrompt } = parseFrontmatter(
          await fs.readFile(path.join(folderPath, promptFile), 'utf-8')
        )

        let filledPrompt: string
        if (filledPrompts?.[folder]) {
          filledPrompt = filledPrompts[folder]
        } else {
          const claudeRes = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: `## Product Context\n${productContext}\n\n## Template\n${rawPrompt}`,
            }],
          })
          filledPrompt = (claudeRes.content[0] as { type: string; text: string }).text.trim()
        }

        const kieRes = await fetch(`${KIE_BASE}/jobs/createTask`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KIE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'nano-banana-2',
            input: {
              prompt: filledPrompt,
              image_input: imageUrls ?? getCloudinaryUrls(productSlug),
              aspect_ratio: meta.ratio ?? '1:1',
              resolution: '1K',
              output_format: 'png',
            },
          }),
        })

        const kieData = await kieRes.json()
        return { folder, filledPrompt, taskId: kieData.data?.taskId ?? null }
      } catch (err) {
        return { folder, error: String(err) }
      }
    })
  )

  return NextResponse.json({ jobs })
}

function parseFrontmatter(raw: string) {
  const divider = raw.indexOf('\n---\n')
  if (divider === -1) return { meta: {} as Record<string, string>, rawPrompt: raw.trim() }
  const meta: Record<string, string> = {}
  for (const line of raw.slice(0, divider).split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, rawPrompt: raw.slice(divider + 5).trim() }
}

function getCloudinaryUrls(slug: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  return [
    `https://res.cloudinary.com/${cloud}/image/upload/${slug}/front.png`,
    `https://res.cloudinary.com/${cloud}/image/upload/${slug}/angle.png`,
  ]
}
