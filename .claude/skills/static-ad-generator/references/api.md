# API Reference — Static Ad Generator

## Ad Format Slugs (001–040)

| Slug | UI Label |
|---|---|
| `bold-claim` | Bold Claim |
| `bold-headline` | Bold Headline |
| `bold-statement` | Bold Statement |
| `testimonial` | Testimonial |
| `annotated-testimonial` | Annotated Testimonial |
| `verified-review` | Verified Review |
| `pull-quote-review` | Pull Quote Review |
| `features-benefits` | Features & Benefits |
| `benefit-checklist` | Benefit Checklist |
| `bullet-points` | Bullet Points |
| `social-proof` | Social Proof |
| `us-vs-them` | Us vs. Them |
| `us-vs-them-split` | Us vs. Them Split |
| `comparison-grid` | Comparison Grid |
| `before-after-ugc` | Before & After UGC |
| `whiteboard-before-after` | Whiteboard Before/After |
| `stat-surround-product` | Stat Surround Product |
| `stat-surround-lifestyle` | Stat Surround Lifestyle |
| `stat-callout` | Stat Callout |
| `lifestyle-action` | Lifestyle Action |
| `hero-product` | Hero Product |
| `hero-statement-icon` | Hero Statement |
| `hero-offer-burst` | Hero Offer Burst |
| `bundle-showcase` | Bundle Showcase |
| `feature-arrow` | Feature Arrow |
| `flavor-story` | Flavor Story |
| `manifesto` | Manifesto |
| `advertorial-editorial` | Advertorial |
| `press-editorial` | Press Editorial |
| `faux-press` | Faux Press |
| `faux-iphone-notes` | Faux iPhone Notes |
| `social-comment` | Social Comment |
| `product-comment` | Product Comment |
| `ugc-viral-overlay` | UGC Viral Overlay |
| `ugc-story` | UGC Story |
| `ugc-lifestyle-split` | UGC Lifestyle Split |
| `negative-marketing` | Negative Marketing |
| `curiosity-gap-hook` | Curiosity Gap Hook |
| `curiosity-scroll-stopper` | Curiosity Scroll Stopper |
| `native-post-it` | Native Post-It |

---

## POST /api/generate-prompts

Fills [PLACEHOLDERS] via Claude only — no image generation. Use for the two-step flow where user wants to review prompts before generating images.

```json
// Request
{
  "templateFolders": ["template-prompt-001", "template-prompt-004"],
  "productSlug": "brush",
  "model": "claude-haiku-4-5-20251001"
}

// Response
{
  "prompts": [
    { "folder": "template-prompt-001", "filledPrompt": "Use the attached images..." },
    { "folder": "template-prompt-004", "filledPrompt": "..." }
  ]
}
```

---

## POST /api/generate

Fills prompts (or accepts pre-filled) and submits jobs to Kie.ai.

```json
// Request
{
  "templateFolders": ["template-prompt-001"],
  "productSlug": "brush",
  "model": "claude-haiku-4-5-20251001",
  "imageUrls": ["https://..."],         // optional — overrides Cloudinary defaults
  "filledPrompts": {                    // optional — skips Claude, uses these directly
    "template-prompt-001": "Use the attached images as brand reference..."
  }
}

// Response
{
  "jobs": [
    { "folder": "template-prompt-001", "filledPrompt": "...", "taskId": "abc123" }
  ]
}
```

**Kie.ai details:**
- Model: `nano-banana-2`
- Default images: `https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/{slug}/front.png` + `angle.png`
- Endpoint: `POST https://api.kie.ai/api/v1/jobs/createTask`

---

## GET /api/status?taskId=xxx

Polls Kie.ai for job result.

```json
// Response
{ "status": "success" | "fail" | "pending", "imageUrl": "https://..." }
```

Internal: calls `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=xxx`, parses `data.resultJson` → `resultUrls[0]`.

---

## POST /api/upload

Uploads user reference images to Cloudinary (`ad-studio-refs/` folder). Accepts base64 data URIs.

```json
// Request
{
  "files": [
    { "dataUri": "data:image/png;base64,...", "name": "photo.png" }
  ]
}

// Response
{ "urls": ["https://res.cloudinary.com/..."], "errors": [] }
```

Max 14 images. Accepted types: JPEG, PNG, WEBP.

---

## GET /api/products

Returns list of product slugs from the `products/` directory.

```json
{ "products": ["brush", "flashlight"] }
```

---

## GET /api/templates

Reads all `template-prompt-{NNN}` folders from `references/`, parses frontmatter, returns template metadata + ref image URL.

```json
{
  "templates": [
    {
      "folder": "template-prompt-001",
      "adFormat": "bold-claim",
      "ratio": "4:5",
      "promptBody": "Use the attached images...",
      "refImg": "/api/ref-img?folder=template-prompt-001&file=ref-img-001.png"
    }
  ]
}
```

---

## Two-step workflow (recommended)

```
1. POST /api/generate-prompts
   → Claude fills [PLACEHOLDERS] from product docs
   → User reviews / edits prompts in Output panel

2. POST /api/generate  (pass filledPrompts)
   → Skips Claude, submits directly to Kie.ai
   → Returns taskId per template

3. Frontend polls GET /api/status?taskId=xxx every 5s
4. status === 'success' → imageUrl available → user clicks Save → downloads
```

## One-step workflow (fast)

```
POST /api/generate  (no filledPrompts)
→ Claude fills + Kie.ai submit in single call
```
