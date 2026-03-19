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

interface GalleryItem {
  folder: string
  imageUrl: string
  adFormat: string
  ratio: string
  savedAt: number // timestamp ms
}

const ALL_FILTERS = [
  { label: 'All', value: 'all', type: 'all' as const },
  { label: 'Bold Claim', value: 'bold-claim', type: 'format' as const },
  { label: 'Bold Headline', value: 'bold-headline', type: 'format' as const },
  { label: 'Bold Statement', value: 'bold-statement', type: 'format' as const },
  { label: 'Testimonial', value: 'testimonial', type: 'format' as const },
  { label: 'Annotated Testimonial', value: 'annotated-testimonial', type: 'format' as const },
  { label: 'Verified Review', value: 'verified-review', type: 'format' as const },
  { label: 'Pull Quote Review', value: 'pull-quote-review', type: 'format' as const },
  { label: 'Features & Benefits', value: 'features-benefits', type: 'format' as const },
  { label: 'Benefit Checklist', value: 'benefit-checklist', type: 'format' as const },
  { label: 'Bullet Points', value: 'bullet-points', type: 'format' as const },
  { label: 'Social Proof', value: 'social-proof', type: 'format' as const },
  { label: 'Us vs. Them', value: 'us-vs-them', type: 'format' as const },
  { label: 'Us vs. Them Split', value: 'us-vs-them-split', type: 'format' as const },
  { label: 'Comparison Grid', value: 'comparison-grid', type: 'format' as const },
  { label: 'Before & After UGC', value: 'before-after-ugc', type: 'format' as const },
  { label: 'Whiteboard Before/After', value: 'whiteboard-before-after', type: 'format' as const },
  { label: 'Stat Surround Product', value: 'stat-surround-product', type: 'format' as const },
  { label: 'Stat Surround Lifestyle', value: 'stat-surround-lifestyle', type: 'format' as const },
  { label: 'Stat Callout', value: 'stat-callout', type: 'format' as const },
  { label: 'Lifestyle Action', value: 'lifestyle-action', type: 'format' as const },
  { label: 'Hero Product', value: 'hero-product', type: 'format' as const },
  { label: 'Hero Statement', value: 'hero-statement-icon', type: 'format' as const },
  { label: 'Hero Offer Burst', value: 'hero-offer-burst', type: 'format' as const },
  { label: 'Bundle Showcase', value: 'bundle-showcase', type: 'format' as const },
  { label: 'Feature Arrow', value: 'feature-arrow', type: 'format' as const },
  { label: 'Flavor Story', value: 'flavor-story', type: 'format' as const },
  { label: 'Manifesto', value: 'manifesto', type: 'format' as const },
  { label: 'Advertorial', value: 'advertorial-editorial', type: 'format' as const },
  { label: 'Press Editorial', value: 'press-editorial', type: 'format' as const },
  { label: 'Faux Press', value: 'faux-press', type: 'format' as const },
  { label: 'Faux iPhone Notes', value: 'faux-iphone-notes', type: 'format' as const },
  { label: 'Social Comment', value: 'social-comment', type: 'format' as const },
  { label: 'Product Comment', value: 'product-comment', type: 'format' as const },
  { label: 'UGC Viral Overlay', value: 'ugc-viral-overlay', type: 'format' as const },
  { label: 'UGC Story', value: 'ugc-story', type: 'format' as const },
  { label: 'UGC Lifestyle Split', value: 'ugc-lifestyle-split', type: 'format' as const },
  { label: 'Negative Marketing', value: 'negative-marketing', type: 'format' as const },
  { label: 'Curiosity Gap Hook', value: 'curiosity-gap-hook', type: 'format' as const },
  { label: 'Curiosity Scroll Stopper', value: 'curiosity-scroll-stopper', type: 'format' as const },
  { label: 'Native Post-It', value: 'native-post-it', type: 'format' as const },
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
  const [generatingImageFor, setGeneratingImageFor] = useState<Set<string>>(new Set())
  const [generatingPromptFor, setGeneratingPromptFor] = useState<Set<string>>(new Set())
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [midTab, setMidTab] = useState<'templates' | 'gallery'>('templates')
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [showNewTplModal, setShowNewTplModal] = useState(false)
  const [newTplFile, setNewTplFile] = useState<{ preview: string; dataUri: string } | null>(null)
  const [newTplFormat, setNewTplFormat] = useState('auto')
  const [newTplDragOver, setNewTplDragOver] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [newTplResult, setNewTplResult] = useState<string | null>(null)

  // Left sidebar tab
  const [leftTab, setLeftTab] = useState<'dropshipping' | 'pod'>('dropshipping')

  // POD mode state
  const [podMockup, setPodMockup] = useState<{ preview: string; dataUri: string; url: string | null } | null>(null)
  const [podMockupUploading, setPodMockupUploading] = useState(false)
  const [podDragOver, setPodDragOver] = useState(false)
  const [podDescription, setPodDescription] = useState('')
  const [podContext, setPodContext] = useState('')
  const [extractingContext, setExtractingContext] = useState(false)

  const GALLERY_KEY = 'ad-gallery'
  const TTL = 24 * 60 * 60 * 1000 // 24h

  function loadGallery(): GalleryItem[] {
    try {
      const raw = localStorage.getItem(GALLERY_KEY)
      if (!raw) return []
      const items: GalleryItem[] = JSON.parse(raw)
      const cutoff = Date.now() - TTL
      return items.filter(i => i.savedAt > cutoff)
    } catch { return [] }
  }

  function saveToGallery(newItems: GalleryItem[]) {
    const existing = loadGallery()
    // Merge: replace same folder entries, keep others
    const merged = [
      ...existing.filter(e => !newItems.some(n => n.folder === e.folder)),
      ...newItems,
    ]
    localStorage.setItem(GALLERY_KEY, JSON.stringify(merged))
    setGalleryItems(merged)
  }

  function removeFromGallery(folder: string) {
    const updated = loadGallery().filter(i => i.folder !== folder)
    localStorage.setItem(GALLERY_KEY, JSON.stringify(updated))
    setGalleryItems(updated)
  }

  useEffect(() => {
    setGalleryItems(loadGallery())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function reloadTemplates() {
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d.templates ?? []))
  }

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => {
      const list = d.products ?? []
      setProducts(list)
      if (list.length > 0) setSelectedProduct(list[0])
    })
    reloadTemplates()
  }, [])

  function handleNewTplFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUri = e.target?.result as string
      setNewTplFile({ preview: URL.createObjectURL(file), dataUri })
    }
    reader.readAsDataURL(file)
  }

  async function createTemplate() {
    if (!newTplFile) return
    setCreatingTemplate(true)
    setNewTplResult(null)
    try {
      const res = await fetch('/api/new-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUri: newTplFile.dataUri, adFormat: newTplFormat }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNewTplResult(`Template ${data.templateNumber} created · ${data.adFormat}`)
      reloadTemplates()
      setTimeout(() => {
        setShowNewTplModal(false)
        setNewTplFile(null)
        setNewTplFormat('auto')
        setNewTplResult(null)
      }, 1800)
    } catch (err) {
      setNewTplResult(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    } finally {
      setCreatingTemplate(false)
    }
  }

  const activeFilterDef = ALL_FILTERS.find(f => f.value === activeFilter)

  const filtered = templates.filter(t => {
    if (!activeFilterDef || activeFilterDef.type === 'all') return true
    if (activeFilterDef.type === 'format') return t.adFormat === activeFilter
    return true
  })

  const countForFilter = (f: typeof ALL_FILTERS[number]) => {
    if (f.type === 'all') return templates.length
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

  async function handlePodMockup(file: File) {
    if (!file.type.match(/image\/(jpeg|png|webp)/)) return
    const preview = URL.createObjectURL(file)
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setPodMockup({ preview, dataUri, url: null })
    setPodContext('')
    setPodMockupUploading(true)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ dataUri, name: file.name }] }),
    })
    const data = await res.json()
    setPodMockup(prev => prev ? { ...prev, url: data.urls?.[0] ?? null } : null)
    setPodMockupUploading(false)
  }

  async function extractPodContext() {
    if (!podMockup) return
    setExtractingContext(true)
    try {
      const res = await fetch('/api/extract-pod-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUri: podMockup.dataUri, description: podDescription }),
      })
      const data = await res.json()
      if (data.context) setPodContext(data.context)
    } catch (err) {
      console.error('extractPodContext failed:', err)
    } finally {
      setExtractingContext(false)
    }
  }

  async function generatePrompts() {
    const isPod = leftTab === 'pod'
    if (isPod ? (!podContext || selectedFolders.size === 0) : (!selectedProduct || selectedFolders.size === 0)) return
    setGeneratingPrompts(true)
    setCustomPrompts({})
    setJobs([])
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPod
          ? { templateFolders: Array.from(selectedFolders), podContext, model }
          : { templateFolders: Array.from(selectedFolders), productSlug: selectedProduct, model }
        ),
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

  async function generateSinglePrompt(folder: string) {
    const isPod = leftTab === 'pod'
    if (isPod ? !podContext : !selectedProduct) return
    setGeneratingPromptFor(prev => new Set(prev).add(folder))
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPod
          ? { templateFolders: [folder], podContext, model }
          : { templateFolders: [folder], productSlug: selectedProduct, model }
        ),
      })
      if (!res.ok) { console.error('generate-prompts error:', res.status, await res.text()); return }
      const data = await res.json()
      const p = data.prompts?.[0]
      if (p?.filledPrompt) setCustomPrompts(prev => ({ ...prev, [folder]: p.filledPrompt }))
    } catch (err) {
      console.error('generateSinglePrompt failed:', err)
    } finally {
      setGeneratingPromptFor(prev => { const n = new Set(prev); n.delete(folder); return n })
    }
  }

  async function generateSingleImage(folder: string) {
    const isPod = leftTab === 'pod'
    if (!hasImages) return
    if (!isPod && !selectedProduct) return
    setGeneratingImageFor(prev => new Set(prev).add(folder))
    setJobs(prev => {
      const existing = prev.find(j => j.folder === folder)
      if (existing) return prev.map(j => j.folder === folder ? { ...j, status: 'pending', imageUrl: undefined, error: undefined, taskId: null } : j)
      return [...prev, { folder, taskId: null, status: 'pending' }]
    })
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPod
          ? {
              templateFolders: [folder],
              podContext,
              model,
              imageUrls: podMockup?.url ? [podMockup.url] : undefined,
              filledPrompts: customPrompts[folder] ? { [folder]: customPrompts[folder] } : undefined,
            }
          : {
              templateFolders: [folder],
              productSlug: selectedProduct,
              model,
              imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
              filledPrompts: customPrompts[folder] ? { [folder]: customPrompts[folder] } : undefined,
            }
        ),
      })
      if (!res.ok) { console.error('generate error:', res.status, await res.text()); return }
      const data = await res.json()
      const job: JobResult = data.jobs?.[0]
      if (job) {
        setJobs(prev => prev.map(j => j.folder === folder ? { ...j, ...job, status: job.error ? 'error' : job.taskId ? 'pending' : 'error' } : j))
        if (job.taskId) pollJob(job.taskId)
      }
    } catch (err) {
      console.error('generateSingleImage failed:', err)
    } finally {
      setGeneratingImageFor(prev => { const n = new Set(prev); n.delete(folder); return n })
    }
  }

  async function generateImages() {
    const isPod = leftTab === 'pod'
    if (selectedFolders.size === 0) return
    if (isPod ? !podContext : !selectedProduct) return
    setGeneratingImages(true)
    setJobs([])
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPod
          ? {
              templateFolders: Array.from(selectedFolders),
              podContext,
              model,
              imageUrls: podMockup?.url ? [podMockup.url] : undefined,
              filledPrompts: Object.keys(customPrompts).length > 0 ? customPrompts : undefined,
            }
          : {
              templateFolders: Array.from(selectedFolders),
              productSlug: selectedProduct,
              model,
              imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
              filledPrompts: Object.keys(customPrompts).length > 0 ? customPrompts : undefined,
            }
        ),
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
      setJobs(prev => {
        const next = prev.map(j =>
          j.taskId === taskId
            ? { ...j, status: data.status ?? j.status, imageUrl: data.imageUrl ?? j.imageUrl }
            : j
        )
        if (data.status === 'success' && data.imageUrl) {
          const job = next.find(j => j.taskId === taskId)
          if (job) {
            const tpl = templates.find(t => t.folder === job.folder)
            saveToGallery([{
              folder: job.folder,
              imageUrl: data.imageUrl,
              adFormat: tpl?.adFormat ?? '',
              ratio: tpl?.ratio ?? '',
              savedAt: Date.now(),
            }])
          }
        }
        return next
      })
      if (data.status === 'success' || data.status === 'fail') clearInterval(interval)
    }, 5000)
  }

  async function downloadImage(imageUrl: string, filename: string) {
    const blob = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`).then(r => r.blob())
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  async function downloadAllImages() {
    const doneJobs = jobs.filter(j => j.imageUrl)
    if (doneJobs.length === 0) return
    const res = await fetch('/api/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: doneJobs.map(j => ({ url: j.imageUrl!, filename: `${j.folder}.png` })),
      }),
    })
    if (!res.ok) { console.error('download-zip failed', res.status); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${selectedProduct}-ads.zip`
    a.click()
  }

  const hasOutput = selectedFolders.size > 0 || jobs.length > 0 || Object.keys(customPrompts).length > 0
  const hasPrompts = Object.keys(customPrompts).length > 0
  const loading = generatingPrompts || generatingImages
  const hasImages = leftTab === 'pod' ? (podMockup?.url != null) : (refImages.length > 0 && !uploading)
  const allPromptsReady = selectedFolders.size > 0 && Array.from(selectedFolders).every(f => !!customPrompts[f])

  return (
    <div className="h-screen bg-white flex font-sans overflow-hidden">
      <div className="w-full flex overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="w-[20%] shrink-0 border-r border-black/8 flex flex-col bg-white overflow-hidden">
          {/* Header */}
          <div className="min-h-[106px] px-5 pt-4 pb-0 flex flex-col justify-between border-b border-black/8 shrink-0">
            <h1 className="text-xl font-bold text-black tracking-tight">🙏 Mark - Give Me Money</h1>
            {/* Tabs */}
            <div className="flex items-end gap-1 mt-2">
              {(['dropshipping', 'pod'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
                    leftTab === tab
                      ? 'bg-white border-black/8 text-black -mb-px z-10'
                      : 'bg-transparent border-transparent text-black/40 hover:text-black/60'
                  }`}
                >
                  {tab === 'dropshipping' ? 'Dropshipping' : 'POD'}
                </button>
              ))}
            </div>
          </div>

          {/* Dropshipping: Filters */}
          {leftTab === 'dropshipping' && (
            <div className="px-5 pt-4 pb-3 overflow-y-auto flex-1">
              <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest mb-3">Format</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_FILTERS.map(f => {
                  const active = activeFilter === f.value
                  const count = countForFilter(f)
                  return (
                    <button
                      key={f.value}
                      onClick={() => setActiveFilter(f.value)}
                      className={`flex items-center justify-between gap-1 rounded-full px-3 py-2 transition-colors text-left border ${
                        active
                          ? 'bg-[#e8f5e9] border-[#4caf50]/40 text-black font-semibold'
                          : 'bg-black/4 border-transparent text-black/55 hover:bg-black/8'
                      }`}
                    >
                      <span className="text-[11px] leading-tight truncate">{f.label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] tabular-nums shrink-0 ${active ? 'text-black/40' : 'text-black/25'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* POD: Mockup upload + context extraction */}
          {leftTab === 'pod' && (
            <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Mockup</p>

              {/* Mockup drop zone */}
              <label
                className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
                  podDragOver ? 'border-[#4caf50] bg-[#f1f8e9]' : 'border-black/15 hover:border-black/25'
                }`}
                style={{ minHeight: '120px' }}
                onDragOver={e => { e.preventDefault(); setPodDragOver(true) }}
                onDragLeave={() => setPodDragOver(false)}
                onDrop={e => { e.preventDefault(); setPodDragOver(false); if (e.dataTransfer.files[0]) handlePodMockup(e.dataTransfer.files[0]) }}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => e.target.files?.[0] && handlePodMockup(e.target.files[0])}
                />
                {podMockup ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={podMockup.preview} alt="Mockup" className="w-full object-cover" style={{ maxHeight: '200px' }} />
                    {podMockupUploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setPodMockup(null); setPodContext('') }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                    <svg className="w-7 h-7 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                    <p className="text-xs text-black/35 font-medium">Drop mockup here</p>
                    <p className="text-[11px] text-black/20">or click to browse</p>
                  </div>
                )}
              </label>

              {/* Optional description */}
              <textarea
                value={podDescription}
                onChange={e => setPodDescription(e.target.value)}
                placeholder="Optional: product name, price, target audience…"
                rows={2}
                className="w-full text-xs rounded-lg border border-black/10 bg-black/2 px-3 py-2 text-black/70 resize-none placeholder:text-black/25 focus:outline-none focus:border-black/25"
              />

              {/* Extract button */}
              <button
                onClick={extractPodContext}
                disabled={!podMockup || podMockupUploading || extractingContext}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#4caf50] px-3 py-2 text-xs font-semibold text-[#2e7d32] hover:bg-[#e8f5e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {extractingContext ? (
                  <><div className="w-3 h-3 border border-[#4caf50] border-t-transparent rounded-full animate-spin" /> Extracting…</>
                ) : podContext ? '↻ Re-extract context' : 'Extract context from mockup'}
              </button>

              {/* Extracted context (editable) */}
              {podContext && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Extracted Context</p>
                  <textarea
                    value={podContext}
                    onChange={e => setPodContext(e.target.value)}
                    rows={7}
                    className="w-full text-xs rounded-lg border border-[#4caf50]/40 bg-[#f1f8e9] px-3 py-2 text-black/70 resize-none focus:outline-none focus:border-[#4caf50]/60"
                  />
                  <p className="text-[10px] text-black/30">Edit above to refine before generating prompts.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MIDDLE: Tabs */}
        <div className="w-[40%] flex flex-col min-w-0 border-r border-black/8">
          {/* Tab bar (replaces spacer) */}
          <div className="min-h-[106px] border-b border-black/8 shrink-0 flex items-end px-4 pb-0 gap-1">
            {(['templates', 'gallery'] as const).map(tab => {
              const label = tab === 'templates' ? 'Templates' : `Gallery${galleryItems.length > 0 ? ` (${galleryItems.length})` : ''}`
              return (
                <button
                  key={tab}
                  onClick={() => setMidTab(tab)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-t border-x ${
                    midTab === tab
                      ? 'bg-white border-black/8 text-black'
                      : 'bg-transparent border-transparent text-black/40 hover:text-black/60'
                  }`}
                >
                  {label}
                </button>
              )
            })}
            <button
              onClick={() => { setShowNewTplModal(true); setNewTplFile(null); setNewTplFormat('auto'); setNewTplResult(null) }}
              className="ml-auto mb-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-dashed border-black/20 text-black/40 hover:border-[#4caf50] hover:text-[#2e7d32] transition-colors"
            >
              + Add New Template
            </button>
          </div>

          {/* Templates tab */}
          {midTab === 'templates' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-3 items-start">
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
                      {t.refImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.refImg} alt={t.folder} className="w-full h-auto block" />
                      ) : (
                        <div className="w-full aspect-square bg-[#edeae5] flex items-center justify-center text-black/20 text-xs">No preview</div>
                      )}
                      <div className="px-2.5 py-2">
                        <p className="text-xs font-semibold text-black truncate">{name}</p>
                        <p className="text-[11px] text-black/40 mt-0.5">{t.ratio} · {t.adFormat || '—'}</p>
                      </div>
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
          )}

          {/* Gallery tab */}
          {midTab === 'gallery' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {galleryItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                  <div className="w-14 h-14 rounded-xl bg-black/5 flex items-center justify-center">
                    <svg className="w-7 h-7 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                  </div>
                  <p className="text-sm text-black/35">No generated images yet</p>
                </div>
              ) : (
                <>
                  <div className="px-4 pt-4 pb-3 shrink-0">
                    <button
                      onClick={() => {
                        // Use galleryItems for download all
                        const doneJobs = galleryItems.map(g => ({ folder: g.folder, imageUrl: g.imageUrl, taskId: null }))
                        fetch('/api/download-zip', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ images: doneJobs.map(j => ({ url: j.imageUrl, filename: `${j.folder}.png` })) }),
                        }).then(r => r.blob()).then(blob => {
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = 'ads-gallery.zip'
                          a.click()
                        })
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-black/15 bg-black/4 px-3 py-2.5 text-xs font-semibold text-black/70 hover:bg-black/8 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download all as ZIP ({galleryItems.length} images)
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[...galleryItems].sort((a, b) => b.savedAt - a.savedAt).map(g => {
                        const name = g.folder.replace('template-prompt-', 'Template ')
                        return (
                          <div key={g.folder} className="flex flex-col gap-1">
                            <div className="relative rounded-md overflow-hidden border border-black/8 bg-[#f7f4f0] cursor-zoom-in group">
                              <div onClick={() => setPreviewUrl(g.imageUrl)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={g.imageUrl} alt={g.folder} className="w-full h-auto block" />
                              </div>
                              <button
                                onClick={() => removeFromGallery(g.folder)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-[11px] font-semibold text-black truncate">{name}</p>
                            <p className="text-[10px] text-black/40">{g.ratio} · {g.adFormat || '—'}</p>
                            <button
                              onClick={() => downloadImage(g.imageUrl, `${g.folder}.png`)}
                              className="w-full text-[11px] font-semibold text-black/50 hover:text-black border border-black/10 rounded-md py-1.5 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Output */}
        <div className="w-[40%] flex flex-col bg-white">
          {/* Header — 3 columns */}
          <div className="min-h-[106px] px-4 py-3 border-b border-black/8 flex gap-3 shrink-0">

            {/* Col 1: Product + Image Upload (Dropshipping) OR POD status */}
            {leftTab === 'dropshipping' ? (
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {products.length === 0 ? (
                  <p className="text-xs text-black/30 italic">No products found</p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-1.5 pr-7 text-xs font-medium text-black capitalize cursor-pointer focus:outline-none focus:border-[#4caf50]/60 focus:ring-1 focus:ring-[#4caf50]/30 transition-colors"
                    >
                      {products.map(p => (
                        <option key={p} value={p} className="capitalize">{p}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <svg className="w-3 h-3 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                {/* Image drop zone */}
                <label
                  className={`flex flex-col w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors p-2 ${
                    dragOver ? 'border-black/40 bg-black/4' : 'border-black/10 bg-black/2 hover:border-black/20'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                >
                  <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files && handleFiles(e.target.files)} />
                  <div className={`flex items-center justify-center gap-1.5 py-0.5 ${refImages.length > 0 ? 'hidden' : ''}`}>
                    <svg className="w-4 h-4 text-black/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                    <span className="text-[10px] text-black/35 font-medium leading-snug">Upload img <span className="text-black/25">· optional · up to 14</span></span>
                  </div>
                  {refImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {refImages.map((img, i) => (
                        <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden bg-black/5 shrink-0 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.preview} alt="" className="w-full h-full object-cover" />
                          {uploadedUrls[i] ? (
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); removeRefImage(i) }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            >
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && <p className="text-[10px] text-black/30 mt-1">Uploading…</p>}
                </label>
                {!uploading && refImages.length === 0 && selectedFolders.size > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">⚠ Add a product image to generate</p>
                )}
              </div>
            ) : (
              /* POD mode col 1: status indicators */
              <div className="flex-1 flex flex-col justify-center gap-2.5 min-w-0">
                <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">POD Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${podMockup?.url ? 'bg-[#4caf50]' : podMockupUploading ? 'bg-yellow-400' : 'bg-black/15'}`} />
                  <span className="text-xs text-black/60">
                    {podMockupUploading ? 'Uploading mockup…' : podMockup?.url ? 'Mockup ready' : 'No mockup — upload in sidebar'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${podContext ? 'bg-[#4caf50]' : 'bg-black/15'}`} />
                  <span className="text-xs text-black/60">
                    {podContext ? 'Context extracted' : 'No context — extract in sidebar'}
                  </span>
                </div>
                {!podContext && selectedFolders.size > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">⚠ Extract context first to generate</p>
                )}
              </div>
            )}

            {/* Col 2: Generate Prompts + Model */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <button
                onClick={generatePrompts}
                disabled={generatingPrompts || selectedFolders.size === 0 || (leftTab === 'pod' ? !podContext : !selectedProduct)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#4caf50] px-3 py-1.5 text-xs font-semibold text-[#2e7d32] hover:bg-[#e8f5e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {generatingPrompts ? (
                  <><div className="w-3 h-3 border border-[#4caf50] border-t-transparent rounded-full animate-spin" /> Generating…</>
                ) : (
                  <>{hasPrompts ? '↻ Regenerate prompts' : 'Generate prompts'}</>
                )}
              </button>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full text-xs bg-black/4 border border-black/8 rounded-lg px-2.5 py-2 text-black/70 appearance-none cursor-pointer"
              >
                <option value="claude-haiku-4-5-20251001">Haiku 4.5 — fast</option>
                <option value="claude-sonnet-4-6">Sonnet 4.6 — quality</option>
              </select>
            </div>

            {/* Col 3: Generate Images */}
            <div className="relative group flex-1 min-w-0">
              <button
                onClick={generateImages}
                disabled={generatingImages || selectedFolders.size === 0 || !hasImages || (leftTab === 'pod' ? !podContext : !selectedProduct)}
                className={`w-full h-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-transparent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${
                  allPromptsReady && hasImages
                    ? 'bg-[#4caf50] hover:bg-[#43a047]'
                    : 'bg-black hover:bg-transparent hover:border-black hover:text-black'
                }`}
              >
                {generatingImages ? (
                  <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                ) : 'Generate images'}
              </button>
              {!hasImages && (
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex items-center gap-1.5 whitespace-nowrap bg-black text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none">
                  <svg className="w-3 h-3 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {leftTab === 'pod' ? 'Upload a mockup in the sidebar first' : 'Add a product image first'}
                </div>
              )}
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
                        <span className={`text-[10px] font-semibold ml-auto ${statusColor}`}>{statusLabel !== 'Ready' ? statusLabel : ''}</span>
                        <button
                          onClick={() => toggleFolder(folder)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-500 bg-red-50 shrink-0"
                        >
                          ❌ Clear
                        </button>
                      </div>

                      {/* 3-column: preview | prompt | outcome */}
                      <div className="grid grid-cols-3 gap-3 items-start">

                        {/* Col 1: Template preview img */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Preview</p>
                          <div className="rounded-md overflow-hidden border border-black/8 bg-[#f7f4f0]">
                            {tpl?.refImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={tpl.refImg} alt={folder} className="w-full h-auto block cursor-zoom-in" onClick={() => setPreviewUrl(tpl.refImg!)} />
                            ) : (
                              <div className={`${aspectClass} flex items-center justify-center bg-black/4`}>
                                <p className="text-[11px] text-black/25 text-center px-3">No preview</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Col 2: Prompt */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Prompt</p>
                          <div className="rounded-md border border-dashed border-black/20 bg-white p-3 flex flex-col gap-2 min-h-[80px]">
                            {promptText ? (
                              <p className="text-[11px] text-black/55 leading-relaxed whitespace-pre-wrap">{promptText}</p>
                            ) : (
                              <p className="text-[11px] text-black/25 italic">No prompt loaded</p>
                            )}
                          </div>
                          <button
                            onClick={() => generateSinglePrompt(folder)}
                            disabled={generatingPromptFor.has(folder) || !selectedProduct}
                            className={`w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                              customPrompts[folder] || generatingPromptFor.has(folder)
                                ? 'border-[#4caf50] text-[#2e7d32] hover:bg-[#e8f5e9]'
                                : 'border-black/20 text-black/50 hover:bg-black/4'
                            }`}
                          >
                            {generatingPromptFor.has(folder) ? (
                              <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
                            ) : customPrompts[folder] ? '↻ Regenerate' : 'Generate prompt'}
                          </button>
                        </div>

                        {/* Col 3: Outcome image */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Output</p>
                          <div className="rounded-md overflow-hidden border border-black/8 bg-[#f7f4f0]">
                            {job?.imageUrl ? (
                              <>
                                <div
                                  className={`relative w-full ${aspectClass} cursor-zoom-in`}
                                  onClick={() => setPreviewUrl(job.imageUrl!)}
                                >
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
                                  <p className="text-[11px] text-black/25 text-center px-3">Generate to create image</p>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => generateSingleImage(folder)}
                            disabled={generatingImageFor.has(folder) || !hasImages}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-black border-2 border-transparent py-2 text-xs font-semibold text-white hover:bg-transparent hover:border-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {generatingImageFor.has(folder) ? (
                              <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
                            ) : job?.imageUrl ? '↻ Regenerate' : 'Generate image'}
                          </button>
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

      {/* Add New Template modal */}
      {showNewTplModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !creatingTemplate && setShowNewTplModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-black">Add New Template</h2>
              <button
                onClick={() => !creatingTemplate && setShowNewTplModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/6 hover:bg-black/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-black/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image drop zone */}
            <label
              className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
                newTplDragOver ? 'border-[#4caf50] bg-[#f1f8e9]' : 'border-black/15 hover:border-black/25'
              }`}
              style={{ minHeight: '180px' }}
              onDragOver={e => { e.preventDefault(); setNewTplDragOver(true) }}
              onDragLeave={() => setNewTplDragOver(false)}
              onDrop={e => { e.preventDefault(); setNewTplDragOver(false); if (e.dataTransfer.files[0]) handleNewTplFile(e.dataTransfer.files[0]) }}
            >
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => e.target.files?.[0] && handleNewTplFile(e.target.files[0])}
              />
              {newTplFile ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newTplFile.preview} alt="" className="w-full h-full object-contain max-h-[260px]" />
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setNewTplFile(null) }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 px-4">
                  <svg className="w-8 h-8 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                  </svg>
                  <p className="text-sm font-medium text-black/35">Drop reference ad image here</p>
                  <p className="text-xs text-black/25">or click to browse · JPG, PNG, WEBP</p>
                </div>
              )}
            </label>

            {/* Ad format selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-black/40 uppercase tracking-widest">Ad Format</label>
              <select
                value={newTplFormat}
                onChange={e => setNewTplFormat(e.target.value)}
                className="w-full rounded-lg border border-black/12 px-3 py-2 text-sm text-black bg-white appearance-none cursor-pointer focus:outline-none focus:border-black/30"
              >
                <option value="auto">Auto-detect from image</option>
                <option value="bold-claim">Bold Claim</option>
                <option value="key-benefits">Key Benefits</option>
                <option value="us-vs-them">Us vs. Them</option>
                <option value="before-and-after">Before &amp; After</option>
                <option value="community-ad">Community Ad</option>
                <option value="split-screen">Split Screen</option>
                <option value="grid-swap">Grid Swap</option>
                <option value="price-breakdown">Price Breakdown</option>
                <option value="how-to">How-To</option>
                <option value="testimonial">Testimonial</option>
                <option value="post-it">Post-It</option>
                <option value="promo">Promo</option>
                <option value="problem-vs-solution">Problem vs. Solution</option>
                <option value="press-ad">Press Ad</option>
                <option value="ugly-ad">Ugly Ad</option>
              </select>
            </div>

            {/* Result / status */}
            {newTplResult && (
              <p className={`text-xs font-medium ${newTplResult.startsWith('Error') ? 'text-red-500' : 'text-[#2e7d32]'}`}>
                {newTplResult}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => !creatingTemplate && setShowNewTplModal(false)}
                className="flex-1 py-2 rounded-lg border border-black/12 text-sm font-semibold text-black/50 hover:bg-black/4 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTemplate}
                disabled={!newTplFile || creatingTemplate}
                className="flex-1 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {creatingTemplate ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="block max-w-[90vw] max-h-[90vh] object-contain" />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
