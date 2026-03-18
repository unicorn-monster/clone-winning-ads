---
name: static-ad-generator
description: >
  DTC static ad image generator — an internal Next.js tool where Claude fills
  [PLACEHOLDER] tokens in ad prompt templates using product docs, then Kie.ai
  generates the images. Use this skill whenever the user is working in the
  static-ad-generator project, including: adding or editing ad templates,
  adding a new product, fixing prompt-filling behavior, adjusting the UI
  layout, debugging image generation, writing new [PLACEHOLDER]-based prompts,
  or understanding how any part of the system works.
---

# Static Ad Generator

## What this project does

A 3-panel internal web tool (Next.js, running on localhost:3001):
- **Sidebar** — pick a product, upload reference images, choose model
- **Template grid** — browse 40 ad templates (001–040), filter by format, select multiple
- **Output panel** — generate prompts → review/edit → generate images → save

The core idea: each template has a `prompt-{NNN}` file with `[PLACEHOLDER]` tokens. Claude fills those tokens using the product's `.md` docs, producing a ready-to-send image generation prompt for Kie.ai.

---

## The #1 rule: PLACEHOLDER filling

When filling prompt templates, Claude's job is **surgical replacement only**:

- Replace ONLY the exact `[PLACEHOLDER]` tokens
- Every word, punctuation mark, and space outside brackets stays **character-for-character identical**
- No markdown (`**bold**`, `##`, bullet points)
- No added sentences, elements, or creative rewrites
- Source values from the product docs — never invent
- Output ONLY the completed prompt — no preamble, no wrapper

This rule applies everywhere: the `generate-prompts` route, the `generate` route, and any time you're asked to fill a template manually.

---

## Common tasks

### Adding a new ad template

1. Create `references/template-prompt-{NNN}/` (next number in sequence)
2. Copy the reference image as `ref-img-{NNN}.png`
3. Write `prompt-{NNN}` with frontmatter + [PLACEHOLDER]-based body:

```
ad-format: <slug>
ratio: 4:5
---
[prompt body with [PLACEHOLDERS] for product-specific values]
```

Good placeholders are specific enough to be fillable from docs: `[HEADLINE, 5-8 words]`, `[BRAND COLOR]`, `[PRODUCT NAME]`. Bad placeholders are vague rewrites: `[DESCRIBE THE PRODUCT]`.

### Adding a new product

Create `products/{slug}/` with at minimum:
- `brand-dna.md` — voice, tone, colors, typography, brand claims
- `{slug}-pdp.md` — product copy, specs, key benefits, proof points

These files are **provided by the user — never generate or modify them** unless explicitly asked.

### Fixing prompt-filling quality

The system prompt lives in two places — keep them in sync:
- `app/app/api/generate-prompts/route.ts` → `SYSTEM_PROMPT`
- `app/app/api/generate/route.ts` → `SYSTEM_PROMPT`

If Claude is over-writing (adding content beyond brackets), tighten the "Replace ONLY" instruction. If it's under-filling (leaving brackets in), check that the product docs actually contain the needed values.

### Debugging image generation

The Kie.ai flow: `POST /api/generate` → returns `taskId` → frontend polls `GET /api/status?taskId=xxx` every 5s → `status: success` → `imageUrl` available.

Status values from Kie.ai: `success`, `fail`, pending states. Check `app/app/api/status/route.ts` — it parses `data.data.resultJson` as JSON and pulls `resultUrls[0]`.

### Modifying the UI layout

Three columns in `app/app/page.tsx`, look for the `LEFT SIDEBAR`, `MIDDLE`, `RIGHT` comments:
- Sidebar width: `w-[20%]`
- Template grid: `w-[50%]`
- Output panel: `w-[30%]`

### Adding/updating ad format filters

Filters live in `ALL_FILTERS` at the top of `app/app/page.tsx`. Each entry needs a `label`, `value` (matching the `ad-format` slug in the prompt file), and `type: 'format'`.

---

## Folder structure

```
static-ad-generator/
├── products/
│   └── {slug}/
│       ├── brand-dna.md          ← user-provided, do not modify
│       └── {slug}-pdp.md         ← user-provided, do not modify
│
├── references/
│   └── template-prompt-{NNN}/    ← NNN = 001–040
│       ├── prompt-{NNN}          ← frontmatter + [PLACEHOLDER] prompt
│       └── ref-img-{NNN}.png     ← preview shown in UI grid
│
└── app/app/
    ├── page.tsx                  ← entire UI
    └── api/
        ├── generate-prompts/     ← Claude fills [PLACEHOLDERS] only
        ├── generate/             ← Claude fill + Kie.ai submit
        ├── status/               ← poll Kie.ai job
        ├── upload/               ← Cloudinary image upload
        ├── products/             ← list product slugs
        ├── templates/            ← list templates + parse frontmatter
        └── ref-img/              ← serve ref image file
```

---

## Prompt file format

```
ad-format: bold-claim
ratio: 4:5
---
Use the attached images as brand reference. Match the exact product colors...
Create: a static ad with a [BACKGROUND] background. Top third: large bold
sans-serif headline reading "[YOUR HEADLINE, under 10 words]"...
```

`ratio` options: `1:1` · `4:5` · `9:16`

For the full list of 40 `ad-format` slugs and their UI labels, see `references/api.md`.

---

## Key env vars

```
ANTHROPIC_API_KEY=      ← Claude API
KIE_API_KEY=            ← Kie.ai image generation
CLOUDINARY_CLOUD_NAME=  ← image hosting
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Set in `app/.env.local`.

## Models

| Model | Use case |
|---|---|
| `claude-haiku-4-5-20251001` | Default — fast, cheap |
| `claude-sonnet-4-6` | Higher quality fills |

---

For detailed API request/response schemas and the full ad-format table, see `references/api.md`.
