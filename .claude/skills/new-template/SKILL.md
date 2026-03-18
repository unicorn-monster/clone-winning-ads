---
name: new-template
description: >
  Creates a new ad template in the static-ad-generator project from a reference image.
  Use this skill whenever the user provides an image and wants to add it as a new template,
  says "make a template from this", "add this as template", "create template NNN", or
  "turn this ad into a template". The skill auto-numbers the template, analyzes the image,
  writes a [PLACEHOLDER]-style prompt, and saves everything to the right folder.
---

# New Template Creator

Turn any reference ad image into a numbered prompt template for the static-ad-generator.

## Project root
`/Users/quanghuy/Antigravity/static-ad-generator`

## Step 1 — Get the image path

If the user provided an image path in their message, use it. If not, ask:
> "What's the path to the reference image?"

## Step 2 — Find the next template number

Scan the `references/` folder:
```bash
ls /Users/quanghuy/Antigravity/static-ad-generator/references/ | grep "template-prompt-" | sort | tail -1
```
Increment the highest number by 1. Zero-pad to 3 digits (e.g. `042`, `043`).

## Step 3 — Study existing templates for style

Before writing anything, read 3–4 existing prompt files to internalize the voice and structure:
- `references/template-prompt-001/prompt-001`
- `references/template-prompt-015/prompt-015`
- `references/template-prompt-025/prompt-025`
- `references/template-prompt-030/prompt-030`

Notice the shared DNA:
- Always opens with: `Use the attached images as brand reference.`
- Layout described in spatial zones: `Top third:`, `Center:`, `Bottom:`, `Lower 25%:`, etc.
- Product photography uses real camera specs: `85mm f/2.8`, `50mm f/1.8`, etc.
- Brand-specific values are always `[PLACEHOLDER]` tokens — never hardcoded
- Ends with the aspect ratio: `4:5 aspect ratio.` or `1:1 aspect ratio.`
- Tone is a creative director briefing a designer — precise, visual, no fluff

## Step 4 — Analyze the reference image

Look at the image carefully and extract:

| Element | What to capture |
|---|---|
| **ad-format** | Pick one from the list below |
| **ratio** | Estimate: `1:1`, `4:5`, `9:16`, `16:9` |
| **Background** | Color, texture, gradient |
| **Layout zones** | How is space divided? Top/middle/bottom proportions |
| **Typography** | Headline size/weight/style, body text, any special treatments |
| **Product placement** | Where is the product? Angle, lighting, surface |
| **Special elements** | Arrows, badges, icons, bars, photo cards, overlays |
| **Color accents** | What colors are used for emphasis or CTAs |
| **Social proof** | Stars, numbers, quotes, review cards |

### Ad format options
`bold-claim` · `key-benefits` · `comparison` · `before-after` · `polished-review` ·
`community-ad` · `split-screen` · `grid-swap` · `price-breakdown` · `how-to` ·
`text-message` · `post-it` · `promo` · `problem-vs-solution` · `news-media` · `lifestyle`

## Step 5 — Write the prompt

Follow this exact file structure:

```
ad-format: [detected-format]
ratio: [detected-ratio]
---
Use the attached images as brand reference. [Match/Create]: [one-sentence setup describing the overall feel and background]. [Zone 1 — e.g. "Top third:"]: [detailed description with [PLACEHOLDERS] for brand values]. [Zone 2]: [description]. [Zone 3]: [description]. [Photography spec if product shot: e.g. "Shot at 85mm f/2.8, soft side light."]. [Mood/feel sentence]. [ratio] aspect ratio.
```

**Placeholder naming conventions:**
- Brand accent color → `[BRAND COLOR]`
- Dark/primary color → `[DARK COLOR]`
- Background → `[BACKGROUND]` or `[LIGHT/DARK BACKGROUND]`
- Product → `[YOUR PRODUCT]`
- Headline text → `[YOUR HEADLINE, under 10 words]`
- Subhead → `[YOUR SUBHEAD, one sentence]`
- Customer quote → `[YOUR CUSTOMER QUOTE]`
- Numbers → `[NUMBER]` or `[YOUR PRICE]`
- Surface/prop → `[SURFACE]`
- Scene → `[LIFESTYLE SCENE]`
- Benefit text → `[BENEFIT 1]`, `[BENEFIT 2]`, etc.

Keep the prompt to 1 paragraph. Dense but readable. One sentence per zone.

## Step 6 — Create the files

```bash
# Create folder
mkdir -p /Users/quanghuy/Antigravity/static-ad-generator/references/template-prompt-NNN

# Write prompt file (use Write tool — not echo)
# File: references/template-prompt-NNN/prompt-NNN

# Copy ref image, preserving extension
cp /path/to/source.jpg .../references/template-prompt-NNN/ref-img-NNN.jpg
```

## Step 7 — Confirm

Tell the user:
- Template number created
- ad-format detected
- Files written: `prompt-NNN` and `ref-img-NNN.[ext]`
- One line summary of what the prompt does
