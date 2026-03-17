'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Template {
  folder: string
  adFormat: string
  ratio: string
  promptBody: string
  refImg: string | null
}

interface JobResult {
  folder: string
  taskId: string | null
  filledPrompt?: string
  error?: string
  status?: string
  imageUrl?: string
}

const ALL_FILTERS = [
  { label: 'All', value: 'all', type: 'all' as const },
  { label: 'Bold Claim', value: 'bold-claim', type: 'format' as const },
  { label: 'Key Benefits', value: 'key-benefits', type: 'format' as const },
  { label: 'Comparison', value: 'comparison', type: 'format' as const },
  { label: 'Before & After', value: 'before-after', type: 'format' as const },
  { label: 'Polished Review', value: 'polished-review', type: 'format' as const },
  { label: 'Community Ad', value: 'community-ad', type: 'format' as const },
  { label: 'Split Screen', value: 'split-screen', type: 'format' as const },
  { label: 'Grid Swap', value: 'grid-swap', type: 'format' as const },
  { label: 'Price Breakdown', value: 'price-breakdown', type: 'format' as const },
  { label: 'How To', value: 'how-to', type: 'format' as const },
  { label: 'Text Message', value: 'text-message', type: 'format' as const },
  { label: 'Post It', value: 'post-it', type: 'format' as const },
  { label: 'Promo', value: 'promo', type: 'format' as const },
  { label: 'Problem vs. Solution', value: 'problem-solution', type: 'format' as const },
  { label: 'News/Media', value: 'news-media', type: 'format' as const },
  { label: 'Lifestyle', value: 'lifestyle', type: 'format' as const },
]

function initials(slug: string) {
  return slug.split(/[-_]/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

export default function Home() {
  const [products, setProducts] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState('all')
  const [model, setModel] = useState('claude-haiku-4-5-20251001')
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [generatingPrompts, setGeneratingPrompts] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => {
      const list = d.products ?? []
      setProducts(list)
      if (list.length > 0) setSelectedProduct(list[0])
    })
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d.templates ?? []))
  }, [])

  const activeFilterDef = ALL_FILTERS.find(f => f.value === activeFilter)

  const filtered = templates.filter(t => {
    if (!activeFilterDef || activeFilterDef.type === 'all') return true
    if (activeFilterDef.type === 'ratio') return t.ratio === activeFilter
    if (activeFilterDef.type === 'format') return t.adFormat === activeFilter
    return true
  })

  const countForFilter = (f: typeof ALL_FILTERS[number]) => {
    if (f.type === 'all') return templates.length
    if (f.type === 'ratio') return templates.filter(t => t.ratio === f.value).length
    return templates.filter(t => t.adFormat === f.value).length
  }

  function toggleFolder(folder: string) {
    setSelectedFolders(prev => {
      const next = new Set(prev)
      next.has(folder) ? next.delete(folder) : next.add(folder)
      return next
    })
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.match(/image\/(jpeg|png|webp)/))
    if (arr.length === 0) return
    const capped = arr.slice(0, 14 - refImages.length)
    const previews = capped.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setRefImages(prev => [...prev, ...previews])
    setUploading(true)

    // Convert to base64 data URIs client-side
    const filePayloads = await Promise.all(
      capped.map(f => new Promise<{ dataUri: string; name: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ dataUri: reader.result as string, name: f.name })
        reader.onerror = reject
        reader.readAsDataURL(f)
      }))
    )

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filePayloads }),
    })
    const data = await res.json()
    if (data.errors?.length) console.error('Upload errors:', data.errors)
    setUploadedUrls(prev => [...prev, ...(data.urls ?? [])])
    setUploading(false)
  }

  function removeRefImage(idx: number) {
    setRefImages(prev => { const n = [...prev]; n.splice(idx, 1); return n })
    setUploadedUrls(prev => { const n = [...prev]; n.splice(idx, 1); return n })
  }

  async function generatePrompts() {
    if (!selectedProduct || selectedFolders.size === 0) return
    setGeneratingPrompts(true)
    setCustomPrompts({})
    setJobs([])
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateFolders: Array.from(selectedFolders),
          productSlug: selectedProduct,
          model,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('generate-prompts error:', res.status, text)
        return
      }
      const data = await res.json()
      const filled: Record<string, string> = {}
      for (const p of data.prompts ?? []) {
        if (p.filledPrompt) filled[p.folder] = p.filledPrompt
      }
      setCustomPrompts(filled)
    } catch (err) {
      console.error('generatePrompts failed:', err)
    } finally {
      setGeneratingPrompts(false)
    }
  }

  async function generateImages() {
    if (!selectedProduct || selectedFolders.size === 0) return
    setGeneratingImages(true)
    setJobs([])
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateFolders: Array.from(selectedFolders),
          productSlug: selectedProduct,
          model,
          imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          filledPrompts: Object.keys(customPrompts).length > 0 ? customPrompts : undefined,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('generate error:', res.status, text)
        return
      }
      const data = await res.json()
      const initialJobs: JobResult[] = (data.jobs ?? []).map((j: JobResult) => ({
        ...j,
        status: j.error ? 'error' : j.taskId ? 'pending' : 'error',
      }))
      setJobs(initialJobs)
      initialJobs.forEach(job => { if (job.taskId) pollJob(job.taskId) })
    } catch (err) {
      console.error('generateImages failed:', err)
    } finally {
      setGeneratingImages(false)
    }
  }

  function pollJob(taskId: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status?taskId=${taskId}`)
      const data = await res.json()
      setJobs(prev =>
        prev.map(j =>
          j.taskId === taskId
            ? { ...j, status: data.status ?? j.status, imageUrl: data.imageUrl ?? j.imageUrl }
            : j
        )
      )
      if (data.status === 'success' || data.status === 'fail') clearInterval(interval)
    }, 5000)
  }

  async function downloadImage(imageUrl: string, filename: string) {
    const blob = await fetch(imageUrl).then(r => r.blob())
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  const hasOutput = selectedFolders.size > 0 || jobs.length > 0 || Object.keys(customPrompts).length > 0
  const hasPrompts = Object.keys(customPrompts).length > 0
  const loading = generatingPrompts || generatingImages

  return (
    <div className="h-screen bg-white flex font-sans overflow-hidden">
      <div className="w-full flex overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="w-64 shrink-0 border-r border-black/8 flex flex-col bg-white">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-black/8">
            <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest mb-0.5">Internal Tool</p>
            <h1 className="text-xl font-bold text-black tracking-tight">Ad Studio</h1>
          </div>

          {/* Product */}
          <div className="px-5 pt-4 pb-3 border-b border-black/8">
            <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest mb-2">Product</p>
            {products.length === 0 ? (
              <p className="text-xs text-black/30 italic">No products found</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 pr-8 text-sm font-medium text-black capitalize cursor-pointer focus:outline-none focus:border-[#4caf50]/60 focus:ring-1 focus:ring-[#4caf50]/30 transition-colors"
                >
                  {products.map(p => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <svg className="w-3.5 h-3.5 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {selectedProduct && (
                  <p className="mt-1.5 text-[11px] text-[#4caf50] font-medium">Brand DNA ready</p>
                )}
              </div>
            )}
          </div>

          {/* Image Input */}
          <div className="px-5 pt-4 pb-3 border-b border-black/8">
            <div className="flex items-baseline gap-1.5 mb-2">
              <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Image Input</p>
              <p className="text-[10px] text-black/25">optional · up to 14</p>
            </div>

            {/* Drop zone */}
            <label
              className={`flex flex-col items-center justify-center gap-1.5 w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors py-4 ${
                dragOver ? 'border-black/40 bg-black/4' : 'border-black/10 bg-black/2 hover:border-black/20'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            >
              <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <svg className="w-6 h-6 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
              </svg>
              <p className="text-[11px] text-black/35 font-medium text-center leading-snug">Click to upload or drag and drop</p>
              <p className="text-[10px] text-black/25 text-center">JPEG, PNG, WEBP · Max 30MB</p>
            </label>

            {/* Thumbnails */}
            {refImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {refImages.map((img, i) => (
                  <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/5 shrink-0 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {uploadedUrls[i] ? (
                      <button
                        onClick={() => removeRefImage(i)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {uploading && <p className="text-[10px] text-black/30 mt-1.5">Uploading…</p>}
          </div>

          {/* Model selector */}
          <div className="px-5 pt-4 pb-3 border-b border-black/8">
            <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest mb-2">Model</p>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-xs bg-black/4 border border-black/8 rounded-lg px-2.5 py-2 text-black/70 appearance-none cursor-pointer"
            >
              <option value="claude-haiku-4-5-20251001">Haiku 4.5 — fast</option>
              <option value="claude-sonnet-4-6">Sonnet 4.6 — quality</option>
            </select>
          </div>

          <div className="flex-1" />
        </div>

        {/* MIDDLE: Template grid */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-black/8 basis-0">
          {/* Filters */}
          <div className="px-4 pt-3 pb-2 border-b border-black/8 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-black/30 uppercase tracking-widest shrink-0">Format</span>
            <div className="flex items-center gap-1 flex-wrap">
              {ALL_FILTERS.map(f => {
                const active = activeFilter === f.value
                const count = countForFilter(f)
                return (
                  <button
                    key={f.value}
                    onClick={() => setActiveFilter(f.value)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                      active ? 'bg-[#e8f5e9] text-black font-semibold' : 'text-black/50 hover:bg-black/4'
                    }`}
                  >
                    <span className="text-[13px]">{f.label}</span>
                    {count > 0 && (
                      <span className={`text-[11px] tabular-nums ${active ? 'text-black/40' : 'text-black/25'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-3 items-start">
              {filtered.map(t => {
                const selected = selectedFolders.has(t.folder)
                const name = t.folder.replace('template-prompt-', 'Template ').replace(/-/g, ' ')
                return (
                  <button
                    key={t.folder}
                    onClick={() => toggleFolder(t.folder)}
                    className={`relative rounded-md overflow-hidden border-2 text-left transition-all bg-[#f7f4f0] ${
                      selected ? 'border-[#4caf50]' : 'border-transparent hover:border-black/15'
                    }`}
                  >
                    {/* Preview */}
                    {t.refImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.refImg} alt={t.folder} className="w-full h-auto block" />
                    ) : (
                      <div className="w-full aspect-square bg-[#edeae5] flex items-center justify-center text-black/20 text-xs">No preview</div>
                    )}
                    {/* Label */}
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-black truncate">{name}</p>
                      <p className="text-[11px] text-black/40 mt-0.5">{t.ratio} · {t.adFormat || '—'}</p>
                    </div>
                    {/* Check */}
                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-[#4caf50] rounded-full flex items-center justify-center shadow">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Output */}
        <div className="flex-1 flex flex-col bg-white basis-0">
          {/* Header */}
          <div className="px-5 py-3 border-b border-black/8 flex items-center gap-3">
            <span className="text-sm font-semibold text-black shrink-0">Output</span>
            <div className="flex items-center gap-2 ml-auto">
              {/* Generate Prompts */}
              <button
                onClick={generatePrompts}
                disabled={generatingPrompts || !selectedProduct || selectedFolders.size === 0}
                className="flex items-center gap-1.5 rounded-lg border border-[#4caf50] px-3 py-1.5 text-xs font-semibold text-[#2e7d32] hover:bg-[#e8f5e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {generatingPrompts ? (
                  <><div className="w-3 h-3 border border-[#4caf50] border-t-transparent rounded-full animate-spin" /> Generating…</>
                ) : (
                  <>{hasPrompts ? '↻ Regenerate prompts' : 'Generate prompts'}</>
                )}
              </button>
              {/* Generate Images */}
              <button
                onClick={generateImages}
                disabled={generatingImages || !selectedProduct || selectedFolders.size === 0}
                className="flex items-center gap-1.5 rounded-lg border border-black/20 bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {generatingImages ? (
                  <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                ) : 'Generate images'}
              </button>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                loading ? 'bg-yellow-100 text-yellow-700' :
                hasOutput ? 'bg-green-100 text-green-700' :
                'bg-green-50 text-green-600'
              }`}>
                {generatingPrompts ? 'Prompting…' : generatingImages ? 'Generating…' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Output content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!hasOutput ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-black/5 flex items-center justify-center">
                  <svg className="w-7 h-7 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                  </svg>
                </div>
                <p className="text-sm text-black/35 leading-snug max-w-[180px]">Pick templates, generate prompts, then create images</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-black/8">
                {Array.from(selectedFolders).map(folder => {
                  const tpl = templates.find(t => t.folder === folder)
                  const job = jobs.find(j => j.folder === folder)
                  const ratio = tpl?.ratio ?? '1:1'
                  const aspectClass = ratio === '9:16' ? 'aspect-[9/16]' : ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'
                  const name = folder.replace('template-prompt-', 'Template ')
                  const promptText = customPrompts[folder] ?? job?.filledPrompt ?? tpl?.promptBody ?? ''
                  const statusColor = !job ? 'text-black/30' : job.status === 'success' ? 'text-green-600' : job.status === 'fail' || job.error ? 'text-red-500' : 'text-yellow-600'
                  const statusLabel = !job ? 'Ready' : job.error ? 'Error' : job.status === 'success' ? 'Done' : job.status === 'fail' ? 'Failed' : 'Generating…'
                  return (
                    <div key={folder} className="py-4 first:pt-0">
                      {/* Row header */}
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-black">{name}</p>
                        <span className="text-[10px] text-black/25">·</span>
                        <span className="text-[10px] text-black/35">{ratio} · {tpl?.adFormat || '—'}</span>
                        <span className={`text-[10px] font-semibold ml-auto ${statusColor}`}>{statusLabel}</span>
                      </div>

                      {/* 2-column: prompt | image */}
                      <div className="grid grid-cols-2 gap-3 items-start">

                        {/* Left: Prompt */}
                        <div className="rounded-md border border-dashed border-black/20 bg-white p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#4caf50]" />
                            <p className="text-[10px] font-semibold text-black/40 uppercase tracking-widest">Prompt</p>
                          </div>
                          {promptText ? (
                            <p className="text-[11px] text-black/55 leading-relaxed whitespace-pre-wrap">{promptText}</p>
                          ) : (
                            <p className="text-[11px] text-black/25 italic">No prompt loaded</p>
                          )}
                        </div>

                        {/* Right: Image */}
                        <div className="rounded-md overflow-hidden border border-black/8 bg-[#f7f4f0]">
                          {job?.imageUrl ? (
                            <>
                              <div className={`relative w-full ${aspectClass}`}>
                                <Image src={job.imageUrl} alt={folder} fill className="object-contain" unoptimized />
                              </div>
                              <div className="px-3 py-2.5">
                                <button
                                  onClick={() => downloadImage(job.imageUrl!, `${folder}.png`)}
                                  className="w-full bg-black text-white text-xs font-semibold py-2 rounded-lg hover:bg-black/80 transition-colors"
                                >
                                  Save image
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className={`${aspectClass} flex items-center justify-center bg-black/4`}>
                              {job && !job.error ? (
                                <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                              ) : job?.error ? (
                                <p className="text-xs text-red-400 px-3 text-center">{job.error}</p>
                              ) : (
                                <p className="text-[11px] text-black/25 text-center px-3">Hit Generate to create image</p>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
