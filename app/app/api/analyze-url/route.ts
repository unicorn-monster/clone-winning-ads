import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a product analyst. Given the scraped markdown content of a product page (Shopify, DTC, etc.), extract structured product information into two documents: a Brand DNA doc and a PDP doc.

Output EXACTLY two sections separated by delimiters. Do not add any text before or after.

===BRAND-DNA===
## Product
- Name: [product name]
- Form: [physical description — shape, color, material, size]
- Logo: [logo description if visible, otherwise omit this line]
- Function: [what it does in one sentence]
- Competitor position: [how it positions against alternatives]

## Offer
- Price: [current price, crossed-out original if available — include discount %]
- Discount: [discount details + any bundled gifts/bonuses]
- Guarantee: [money-back guarantee if mentioned]
- Social proof: [customer count, rating, review count]

## Key Claims
- [claim 1 — specific, quantified where possible]
- [claim 2]
- [claim 3]
- [claim 4]
- [claim 5]

## Colors
- [color name] ([where used]): [hex code — infer from product description if not explicit]
- [repeat for each brand color]

## Visual Direction
- Subjects: [who/what appears in product imagery]
- Environment: [setting — studio, home, outdoor, etc.]
- Lighting: [lighting style]
- Action: [what's happening in the imagery]
- Mood: [emotional tone]
- Style: [photography style — UGC, studio, lifestyle, etc.]

===PDP===
# [Product Name]

**Price:** [price with strikethrough original if available]

[One-sentence product description]

---

## Key Features
- [feature 1]
- [feature 2]
- [feature 3]
- [feature 4]
- [feature 5]

**Rating:** [rating] — [source if available]

---

## Us vs Them

| [Product Name] | [Competitor/Alternative] |
|---|---|
| [advantage 1] | [competitor disadvantage 1] |
| [advantage 2] | [competitor disadvantage 2] |
| [advantage 3] | [competitor disadvantage 3] |
| [advantage 4] | [competitor disadvantage 4] |

---

## Customer Reviews

**[rating] out of 5** — Based on [count] reviews

[Include 3-5 real reviews if available, with reviewer name and quote]

---

## Frequently Asked Questions

[Include real FAQs from the page if available]

RULES:
1. Extract REAL data only — never invent facts, numbers, or reviews
2. If a section has no data on the page, write "Not available on page" for that section
3. Infer brand colors from product descriptions and imagery descriptions
4. Keep the exact structure shown above
5. Do not wrap output in markdown code blocks`

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Step 1: Scrape with Firecrawl
    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlKey) {
      return NextResponse.json({ error: 'FIRECRAWL_API_KEY not configured' }, { status: 500 })
    }

    const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    })

    if (!firecrawlRes.ok) {
      const errText = await firecrawlRes.text()
      return NextResponse.json({ error: `Firecrawl error: ${errText}` }, { status: 502 })
    }

    const firecrawlData = await firecrawlRes.json()
    if (!firecrawlData.success || !firecrawlData.data?.markdown) {
      return NextResponse.json({ error: 'Firecrawl returned no content' }, { status: 502 })
    }

    const scrapedMarkdown = firecrawlData.data.markdown

    // Step 2: Analyze with Claude Sonnet
    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyze this scraped product page and extract the Brand DNA and PDP documents:\n\n${scrapedMarkdown}`,
      }],
    })

    const output = (claudeRes.content[0] as { type: string; text: string }).text.trim()

    // Step 3: Parse delimited response
    const brandDnaMatch = output.match(/===BRAND-DNA===\s*([\s\S]*?)\s*===PDP===/)
    const pdpMatch = output.match(/===PDP===\s*([\s\S]*)$/)

    const brandDna = brandDnaMatch ? brandDnaMatch[1].trim() : ''
    const pdp = pdpMatch ? pdpMatch[1].trim() : ''

    if (!brandDna || !pdp) {
      return NextResponse.json({ error: 'Failed to parse analysis output' }, { status: 500 })
    }

    // Step 4: Build combined format (matches generate-prompts concatenation)
    const combined = `### brand-dna.md\n${brandDna}\n\n---\n\n### pdp.md\n${pdp}`

    return NextResponse.json({ brandDna, pdp, combined })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
