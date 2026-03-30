# Implementation Plan: Analyzing PDP — Auto-generate Product DNA from URL

## Overview

Build a single new API endpoint (`/api/analyze-url`) that scrapes a product page via Firecrawl and analyzes it with Claude Sonnet, plus UI changes in the left sidebar for URL input, preview/edit, and integration with the existing prompt generation pipeline. Zero changes to existing API routes — uses the existing `podContext` parameter.

## Phase 1: API Endpoint

Create the backend endpoint that handles scraping + analysis in a single request.

### Tasks

- [x] Create `/api/analyze-url/route.ts` with POST handler accepting `{ url: string }`
- [x] Add Firecrawl scraping logic (plain fetch, no SDK) calling `https://api.firecrawl.dev/v1/scrape`
- [x] Build Claude Sonnet system prompt with brand-dna template + pdp template
- [x] Add response parsing using `===BRAND-DNA===` / `===PDP===` delimiters
- [x] Return `{ brandDna, pdp, combined }` — combined uses same format as generate-prompts concatenation

### Technical Details

**New file:** `app/app/api/analyze-url/route.ts`

**Firecrawl API call (no SDK needed):**
```typescript
const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url, formats: ['markdown'] }),
})
// Response: { success: true, data: { markdown: "..." } }
```

**Claude Sonnet call:**
- Model: `claude-sonnet-4-6`
- Max tokens: 4096
- System prompt includes both templates (brand-dna structure from `products/brush/brand-dna.md` and PDP structure from `products/brush/brush-pdp.md`)
- Instructions to output with `===BRAND-DNA===` and `===PDP===` delimiters
- Instructions to extract real data only, infer colors from descriptions, never invent facts

**Brand DNA template sections:** Product, Offer, Key Claims, Colors, Visual Direction

**PDP template sections:** Tagline, Benefits (It Makes X Better), Us vs Them table, How It Works, Real Customers Real Results, FAQs

**Combined format** (matches how generate-prompts reads multiple .md files):
```
### brand-dna.md
{brandDna content}

---

### pdp.md
{pdp content}
```

**Env variable needed:** `FIRECRAWL_API_KEY` in `app/.env.local`

## Phase 2: UI — URL Input & Preview

Add the URL input field, analyze button, and editable preview textarea in the left sidebar.

### Tasks

- [x] Add state variables: `urlInput`, `analyzingUrl`, `generatedDna`, `dnaError`
- [x] Add `analyzeUrl()` async handler function
- [x] Add "PRODUCT DNA" section in left sidebar (inside `leftTab === 'dropshipping'` block) with:
  - URL text input with placeholder "Paste product page URL..."
  - "Analyze" button with loading spinner
  - Error display (red text)
  - Success: editable textarea showing combined DNA content
  - "Clear" button to reset generated DNA

### Technical Details

**File to modify:** `app/app/page.tsx`

**New state variables** (add near line 89-136 with existing state):
```typescript
const [urlInput, setUrlInput] = useState('')
const [analyzingUrl, setAnalyzingUrl] = useState(false)
const [generatedDna, setGeneratedDna] = useState<{
  brandDna: string; pdp: string; combined: string
} | null>(null)
const [dnaError, setDnaError] = useState<string | null>(null)
```

**Handler function** (add near line 330-410 with existing handlers):
```typescript
async function analyzeUrl() {
  if (!urlInput.trim()) return
  setAnalyzingUrl(true)
  setDnaError(null)
  setGeneratedDna(null)
  try {
    const res = await fetch('/api/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.trim() }),
    })
    if (!res.ok) {
      const text = await res.text()
      setDnaError(`Analysis failed: ${text}`)
      return
    }
    const data = await res.json()
    setGeneratedDna(data)
  } catch (err) {
    setDnaError(`Analysis failed: ${String(err)}`)
  } finally {
    setAnalyzingUrl(false)
  }
}
```

**UI location:** Inside the `{leftTab === 'dropshipping' && ...}` block (around line 744-791), below the product image upload area.

**Styling:** Match existing sidebar patterns — `bg-[#1a1a1a]`, `border border-white/12`, `rounded-lg`, `text-[10px] font-semibold text-white/30 uppercase tracking-widest` for section headers.

**Editable preview textarea:** When `generatedDna` is set, show a textarea with `generatedDna.combined` value. On change, update `generatedDna.combined` so edits are preserved when generating prompts.

## Phase 3: Pipeline Integration

Connect the generated DNA to the existing prompt generation and image generation flows.

### Tasks

- [x] Create `getProductPayload()` helper function
- [x] Replace all `isPod ? { podContext } : { productSlug }` patterns (~8 locations) with `...getProductPayload()`
- [x] Update disabled conditions on "Generate prompts" and "Generate images" buttons
- [x] Add green status indicator in right panel header when DNA is generated from URL

### Technical Details

**File to modify:** `app/app/page.tsx`

**Helper function:**
```typescript
function getProductPayload() {
  if (leftTab === 'pod') return { podContext }
  if (generatedDna) return { podContext: generatedDna.combined }
  return { productSlug: selectedProduct }
}
```

**Locations to update** (all in page.tsx, currently using `isPod ? podContext : productSlug` pattern):
- `generatePrompts()` — line ~366
- `generateSinglePrompt()` — line ~397
- `generateSingleImage()` — line ~429
- `generateImages()` — line ~470
- `generateAllEmails()` — line ~609
- `generateSingleEmail()` — line ~647
- `generateSingleEmailImage()` — line ~682

**Button disabled conditions to update:**
- "Generate prompts" button — line ~1425: add `&& !generatedDna` to the `!selectedProduct` check
- "Generate images" button — line ~1448: same pattern

**Status indicator in right panel** (around line 1410):
When `generatedDna` is set and `leftTab === 'dropshipping'`, show green dot + "DNA from URL" instead of the product name.
