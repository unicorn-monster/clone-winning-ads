# Requirements: Analyzing PDP — Auto-generate Product DNA from URL

## What it does

A one-click feature that lets the user paste any product page URL into the left sidebar, automatically scrapes the page content using Firecrawl, and uses Claude Sonnet to generate a complete product DNA (brand-dna + pdp documents). The generated DNA is stored in React state (no backend persistence) and feeds directly into the existing prompt generation pipeline via the `podContext` parameter.

## Why

Currently, creating product DNA requires manually writing `brand-dna.md` and `pdp.md` files — a time-consuming process. This feature eliminates that manual work, allowing the user to go from a product URL to generated ad images in minutes instead of hours.

## Acceptance Criteria

1. **URL Input**: User can paste a product page URL in the left sidebar (Dropshipping mode)
2. **Scraping**: Firecrawl API scrapes the product page and returns structured markdown content
3. **Analysis**: Claude Sonnet analyzes the scraped content and generates two documents:
   - `brand-dna` — Product details, offer, key claims, colors, visual direction
   - `pdp` — Tagline, benefits, us-vs-them, how it works, reviews, FAQs
4. **Preview & Edit**: Generated DNA is displayed in an editable textarea so the user can review and modify before use
5. **Pipeline Integration**: Generated DNA works seamlessly with "Generate prompts" and "Generate images" — no changes to existing API routes
6. **No Persistence**: DNA lives only in React state. No files saved to disk. Page refresh clears it.
7. **Clear/Reset**: User can clear the generated DNA and revert to using the filesystem-based product selector
8. **Error Handling**: Clear error messages for invalid URLs, Firecrawl failures, or Claude API errors

## Dependencies

- Firecrawl API (`FIRECRAWL_API_KEY` in `.env.local`)
- Anthropic API (already configured — `ANTHROPIC_API_KEY`)
- Existing `podContext` parameter in `/api/generate-prompts` and `/api/generate` routes

## Related Features

- POD mode's "Extract context from mockup" uses a similar pattern (`podContext`) — this feature reuses that same pipeline
- Product selector dropdown — when DNA is generated from URL, it takes priority over the dropdown selection
