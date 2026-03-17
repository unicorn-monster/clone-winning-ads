---
name: static-ad-generator
description: Internal tool to generate static ad images. User selects product + templates → Claude fills [PLACEHOLDERS] using product context → Kie.ai generates image → download to local.
---

# Static Ad Generator

## Folder Structure

```
static-ad-generator/
├── products/
│   └── {product-slug}/          # e.g. brush/
│       └── *.md                 # any .md files — all loaded as context
│
├── references/
│   ├── brand-dna.md             # shared brand DNA
│   └── template-prompt-{NNN}/
│       ├── prompt-{NNN}         # prompt file with frontmatter + [PLACEHOLDERS]
│       └── ref-img-{NNN}.png    # preview image for UI grid
│
├── skills/
│   └── SKILL.md
│
└── app/
    └── api/
        ├── generate/route.ts
        └── status/route.ts
```

---

## Prompt File Format

```
ad-format: bold-claim
ratio: 4:5
---
[raw prompt with [PLACEHOLDERS]]
```

**`ad-format`** — filter label in UI (e.g. `bold-claim`, `promo`, `us-vs-them`, `before-after`, `testimonial`, `social-proof`, `feature-callout`, `press-editorial`, `negative-bait`, `bullet-list`)  
**`ratio`** — `1:1` · `4:5` · `9:16`

---

## Workflow

```
POST /api/generate
  1. Load references/brand-dna.md
  2. Load ALL *.md from products/{productSlug}/
  3. For each selected template:
     a. Read prompt-{NNN} → parse frontmatter → extract raw prompt
     b. Call Anthropic API → Claude fills [PLACEHOLDERS] using brand-dna + product context
     c. Call Kie.ai (nano-banana-edit) → submit job with filled prompt + Cloudinary image URLs
     d. Return task_id to frontend
  4. Frontend polls GET /api/status?taskId=xxx every 5s
  5. status === 'succeed' → show image → user clicks Save → download to local
```

---

## API Route: `POST /api/generate`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const KIE_BASE = 'https://api.kie.ai/api/v1'

export async function POST(req: NextRequest) {
  const {
    templateFolders,  // e.g. ['template-prompt-001', 'template-prompt-002']
    productSlug,      // e.g. 'brush'
    model = 'claude-haiku-4-5-20251001',
  } = await req.json()

  const refsDir = path.join(process.cwd(), 'references')
  const productDir = path.join(process.cwd(), 'products', productSlug)

  // Load brand DNA
  const brandDna = await fs.readFile(path.join(refsDir, 'brand-dna.md'), 'utf-8')

  // Load all product context files
  const productFiles = await fs.readdir(productDir)
  const productContext = (
    await Promise.all(
      productFiles
        .filter(f => f.endsWith('.md'))
        .map(async f => `### ${f}\n${await fs.readFile(path.join(productDir, f), 'utf-8')}`)
    )
  ).join('\n\n---\n\n')

  const jobs = await Promise.all(
    templateFolders.map(async (folder: string) => {
      const folderPath = path.join(refsDir, folder)
      const files = await fs.readdir(folderPath)
      const promptFile = files.find(f => f.startsWith('prompt-'))
      if (!promptFile) return { folder, error: 'No prompt file found' }

      const { meta, rawPrompt } = parseFrontmatter(
        await fs.readFile(path.join(folderPath, promptFile), 'utf-8')
      )

      // Claude fills [PLACEHOLDERS]
      const claudeRes = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `## Brand DNA\n${brandDna}\n\n## Product Context\n${productContext}\n\n## Template\n${rawPrompt}`,
        }],
      })

      const filledPrompt = (claudeRes.content[0] as any).text.trim()

      // Submit to Kie.ai
      const kieRes = await fetch(`${KIE_BASE}/jobs/createTask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KIE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/nano-banana-edit',
          input: {
            prompt: filledPrompt,
            image_input: getCloudinaryUrls(productSlug),
            image_size: meta.ratio,
            resolution: '1K',
            output_format: 'png',
          },
        }),
      })

      const kieData = await kieRes.json()
      return { folder, filledPrompt, taskId: kieData.data?.taskId ?? null }
    })
  )

  return NextResponse.json({ jobs })
}

function parseFrontmatter(raw: string) {
  const divider = raw.indexOf('\n---\n')
  if (divider === -1) return { meta: {}, rawPrompt: raw.trim() }
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

const SYSTEM_PROMPT = `You are a DTC ad creative director. Fill every [PLACEHOLDER] in the template using real content from the provided docs.

Rules:
- Source everything from brand-dna.md and product context files — never invent
- If something is not in the docs: flag it as [NOT FOUND IN DOCS: best inference]
- Keep template structure exactly — only replace [PLACEHOLDERS]
- When multiple options exist: pick the most specific, emotional, shortest
- Output ONLY the completed prompt — no explanation, no preamble`
```

---

## API Route: `GET /api/status`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  const res = await fetch(
    `https://api.kie.ai/api/v1/jobs/getTask?taskId=${taskId}`,
    { headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` } }
  )
  const data = await res.json()
  return NextResponse.json({
    status: data.data?.status,
    imageUrl: data.data?.output?.imageUrl ?? null,
  })
}
```

---

## Frontend

```typescript
// Poll
async function pollUntilDone(taskId: string): Promise<string> {
  while (true) {
    const { status, imageUrl } = await fetch(`/api/status?taskId=${taskId}`).then(r => r.json())
    if (status === 'succeed') return imageUrl
    if (status === 'failed') throw new Error('Failed')
    await new Promise(r => setTimeout(r, 5000))
  }
}

// Download to local
async function downloadImage(imageUrl: string, filename: string) {
  const blob = await fetch(imageUrl).then(r => r.blob())
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
```

---

## Content Ownership

- `references/brand-dna.md` — **provided by user**, do not generate or modify
- `products/{slug}/*.md` — **provided by user**, do not generate or modify

---

## Env Variables

```
ANTHROPIC_API_KEY=
KIE_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Model Options

| Model | Use case |
|---|---|
| `claude-haiku-4-5-20251001` | Default — fast, cheap, good for testing |
| `claude-sonnet-4-6` | Production runs needing higher quality |
