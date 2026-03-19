import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const ROOT = path.join(process.cwd(), '..')

const SYSTEM_PROMPT = `You are a DTC ad creative director. The template you receive is an image generation prompt written as a visual design brief. Your ONLY job is to swap every [PLACEHOLDER] token with real content from the product docs — nothing else.

Rules:
- Output the template text verbatim, with ONLY the [PLACEHOLDER] tokens replaced by specific product values
- Every word, sentence, and punctuation mark outside of [brackets] must remain exactly as-is
- Do NOT rewrite, restructure, reformat, or comment on the template
- Do NOT add sections, headers, labels, or anything not already in the template
- Do NOT use markdown (no **, no ##)
- Do NOT explain what you're doing or ask for clarification — just output the filled prompt
- For open-ended placeholders like "[list 3-4 negatives]", fill them inline with specific product content
- Source all values from the product docs; infer brand colors and names from context if needed
- Output ONLY the completed prompt — no preamble, no explanation, nothing else`

export async function POST(req: NextRequest) {
  const {
    templateFolders,
    productSlug,
    model = 'claude-haiku-4-5-20251001',
  } = await req.json()

  const refsDir = path.join(ROOT, 'references')
  const productDir = path.join(ROOT, 'products', productSlug)

  const productFiles = await fs.readdir(productDir)
  const productContext = (
    await Promise.all(
      productFiles
        .filter(f => f.endsWith('.md'))
        .map(async f => `### ${f}\n${await fs.readFile(path.join(productDir, f), 'utf-8')}`)
    )
  ).join('\n\n---\n\n')

  const prompts = await Promise.all(
    templateFolders.map(async (folder: string) => {
      try {
        const folderPath = path.join(refsDir, folder)
        const files = await fs.readdir(folderPath)
        const promptFile = files.find(f => f.startsWith('prompt-'))
        if (!promptFile) return { folder, error: 'No prompt file found' }

        const raw = await fs.readFile(path.join(folderPath, promptFile), 'utf-8')
        const rawPrompt = stripFrontmatter(raw)

        const claudeRes = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `## Product Context\n${productContext}\n\n## Template\n${rawPrompt}`,
          }],
        })

        const filledPrompt = (claudeRes.content[0] as { type: string; text: string }).text.trim()
        return { folder, filledPrompt }
      } catch (err) {
        return { folder, error: String(err) }
      }
    })
  )

  return NextResponse.json({ prompts })
}

function stripFrontmatter(raw: string) {
  const divider = raw.indexOf('\n---\n')
  return divider === -1 ? raw.trim() : raw.slice(divider + 5).trim()
}
