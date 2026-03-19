import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const KIE_BASE = 'https://api.kie.ai/api/v1'
const ROOT = path.join(process.cwd(), '..')

// Cache ref image Cloudinary URLs to avoid re-uploading on every generation
const refImageUrlCache = new Map<string, string>()

async function uploadRefImageToCloudinary(filePath: string): Promise<string | null> {
  if (refImageUrlCache.has(filePath)) return refImageUrlCache.get(filePath)!
  try {
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'png'
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`

    const cloud = process.env.CLOUDINARY_CLOUD_NAME!
    const apiKey = process.env.CLOUDINARY_API_KEY!
    const apiSecret = process.env.CLOUDINARY_API_SECRET!
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const folder = 'ad-studio-template-refs'
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha1').update(toSign).digest('hex')

    const body = new URLSearchParams({ file: dataUri, api_key: apiKey, timestamp, folder, signature })
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json()
    if (!data.secure_url) { console.error('Ref image upload failed:', data.error?.message); return null }
    refImageUrlCache.set(filePath, data.secure_url)
    return data.secure_url
  } catch (err) {
    console.error('uploadRefImageToCloudinary error:', err)
    return null
  }
}

const SYSTEM_PROMPT = `You are a DTC ad creative director. Your ONLY job is to replace [PLACEHOLDER] tokens in the template with real content from the product docs.

Strict rules:
- Replace ONLY the exact [PLACEHOLDER] tokens — every word, punctuation, and space outside brackets must remain character-for-character identical
- Do NOT add, remove, reorder, reformat, or rewrite anything else
- Do NOT use markdown formatting (no **bold**, no ##, no bullet points)
- Do NOT add new sentences, elements, or creative decisions
- Source all replacements from the provided product docs — never invent
- If a value is not in the docs, use your best inference but keep it concise
- Output ONLY the completed prompt — no explanation, no preamble, no wrapper`

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

        // Build image_input: product images first, then template reference image
        const productImages = imageUrls ?? getCloudinaryUrls(productSlug)
        const imgFiles = await fs.readdir(folderPath)
        const refImgFile = imgFiles.find(f => f.match(/\.(png|jpg|jpeg|webp)$/i))
        const refImgUrl = refImgFile
          ? await uploadRefImageToCloudinary(path.join(folderPath, refImgFile))
          : null
        const imageInput = refImgUrl ? [...productImages, refImgUrl] : productImages

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
              image_input: imageInput,
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
