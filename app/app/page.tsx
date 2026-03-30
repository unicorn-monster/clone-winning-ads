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

interface EmailSection {
  folder: string
  sectionType: string
  ratio: string
  promptBody: string
  refImg: string | null
  previewImg: string | null
}

interface ReferenceEmail {
  folder: string
  subject: string
  pretext: string
  brand: string
  refImg: string | null
}

interface EmailJob {
  sectionFolder: string
  taskId: string | null
  filledPrompt?: string
  error?: string
  status?: string
  imageUrl?: string
}

interface EmailGalleryItem {
  sectionFolder: string
  sectionType: string
  imageUrl: string
  savedAt: number
}

const ALL_FILTERS = [
  { label: 'All', value: 'all', type: 'all' as const },
  { label: 'Bold Claim', value: 'bold-claim', type: 'format' as const },
  { label: 'Key Benefits', value: 'key-benefits', type: 'format' as const },
  { label: 'Us vs. Them', value: 'us-vs-them', type: 'format' as const },
  { label: 'Before & After', value: 'before-and-after', type: 'format' as const },
  { label: 'Split Screen', value: 'split-screen', type: 'format' as const },
  { label: 'Price Breakdown', value: 'price-breakdown', type: 'format' as const },
  { label: 'How To', value: 'how-to', type: 'format' as const },
  { label: 'Testimonial', value: 'testimonial', type: 'format' as const },
  { label: 'Post-It', value: 'post-it', type: 'format' as const },
  { label: 'Promo', value: 'promo', type: 'format' as const },
  { label: 'Problem vs. Solution', value: 'problem-vs-solution', type: 'format' as const },
  { label: 'Press Ad', value: 'press-ad', type: 'format' as const },
  { label: 'POV', value: 'pov', type: 'format' as const },
  { label: 'Ugly Ad', value: 'ugly-ad', type: 'format' as const },
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
  const [newTplFormat, setNewTplFormat] = useState('')
  const [newTplDragOver, setNewTplDragOver] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [newTplResult, setNewTplResult] = useState<string | null>(null)

  // Left sidebar tab
  const [leftTab, setLeftTab] = useState<'dropshipping' | 'pod' | 'email'>('dropshipping')

  // Email mode state
  const [emailSections, setEmailSections] = useState<Record<string, EmailSection[]>>({})
  const [referenceEmails, setReferenceEmails] = useState<ReferenceEmail[]>([])
  const [emailSectionFilter, setEmailSectionFilter] = useState<string>('hero')
  const [selectedEmailSections, setSelectedEmailSections] = useState<EmailSection[]>([])
  const [selectedRefEmail, setSelectedRefEmail] = useState<string | null>(null)
  const [emailJobs, setEmailJobs] = useState<EmailJob[]>([])
  const [emailCustomPrompts, setEmailCustomPrompts] = useState<Record<string, string>>({})
  const [generatingEmailPromptFor, setGeneratingEmailPromptFor] = useState<Set<string>>(new Set())
  const [generatingEmailImageFor, setGeneratingEmailImageFor] = useState<Set<string>>(new Set())
  const [emailMidTab, setEmailMidTab] = useState<'sections' | 'gallery'>('sections')
  const [emailGalleryItems, setEmailGalleryItems] = useState<EmailGalleryItem[]>([])

  // POD mode state
  const [podMockup, setPodMockup] = useState<{ preview: string; dataUri: string; url: string | null } | null>(null)
  const [podMockupUploading, setPodMockupUploading] = useState(false)
  const [podDragOver, setPodDragOver] = useState(false)
  const [podDescription, setPodDescription] = useState('')
  const [podContext, setPodContext] = useState('')
  const [podNote, setPodNote] = useState('')
  const [extractingContext, setExtractingContext] = useState(false)

  // URL analyzer state
  const [urlInput, setUrlInput] = useState('')
  const [analyzingUrl, setAnalyzingUrl] = useState(false)
  const [generatedDna, setGeneratedDna] = useState<{
    brandDna: string; pdp: string; combined: string
  } | null>(null)
  const [dnaError, setDnaError] = useState<string | null>(null)

  const GALLERY_KEY = 'ad-gallery'
  const EMAIL_GALLERY_KEY = 'email-gallery'
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

  function loadEmailGallery(): EmailGalleryItem[] {
    try {
      const raw = localStorage.getItem(EMAIL_GALLERY_KEY)
      if (!raw) return []
      const items: EmailGalleryItem[] = JSON.parse(raw)
      const cutoff = Date.now() - TTL
      return items.filter(i => i.savedAt > cutoff)
    } catch { return [] }
  }

  function saveToEmailGallery(newItems: EmailGalleryItem[]) {
    const existing = loadEmailGallery()
    const merged = [
      ...existing.filter(e => !newItems.some(n => n.sectionFolder === e.sectionFolder)),
      ...newItems,
    ]
    localStorage.setItem(EMAIL_GALLERY_KEY, JSON.stringify(merged))
    setEmailGalleryItems(merged)
  }

  function removeFromEmailGallery(sectionFolder: string) {
    const updated = loadEmailGallery().filter(i => i.sectionFolder !== sectionFolder)
    localStorage.setItem(EMAIL_GALLERY_KEY, JSON.stringify(updated))
    setEmailGalleryItems(updated)
  }

  useEffect(() => {
    setGalleryItems(loadGallery())
    setEmailGalleryItems(loadEmailGallery())
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
    fetch('/api/email-sections').then(r => r.json()).then(d => setEmailSections(d ?? {}))
    fetch('/api/reference-emails').then(r => r.json()).then(d => setReferenceEmails(d.emails ?? []))
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
        setNewTplFormat('')
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
        body: JSON.stringify({
          imageDataUri: podMockup.dataUri,
          description: podDescription,
          existingContext: podContext || undefined,
          note: podNote || undefined,
        }),
      })
      const data = await res.json()
      if (data.context) {
        setPodContext(data.context)
        setPodNote('')
      }
    } catch (err) {
      console.error('extractPodContext failed:', err)
    } finally {
      setExtractingContext(false)
    }
  }

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

  function getProductPayload() {
    if (leftTab === 'pod') return { podContext }
    if (generatedDna) return { podContext: generatedDna.combined }
    return { productSlug: selectedProduct }
  }

  function hasProductContext() {
    if (leftTab === 'pod') return !!podContext
    if (generatedDna) return true
    return !!selectedProduct
  }

  async function generatePrompts() {
    if (!hasProductContext() || selectedFolders.size === 0) return
    setGeneratingPrompts(true)
    setCustomPrompts({})
    setJobs([])
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateFolders: Array.from(selectedFolders), ...getProductPayload(), model }),
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
    if (!hasProductContext()) return
    setGeneratingPromptFor(prev => new Set(prev).add(folder))
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateFolders: [folder], ...getProductPayload(), model }),
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
    if (!hasProductContext()) return
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
        body: JSON.stringify({
              templateFolders: [folder],
              ...getProductPayload(),
              model,
              imageUrls: isPod ? (podMockup?.url ? [podMockup.url] : undefined) : (uploadedUrls.length > 0 ? uploadedUrls : undefined),
              filledPrompts: customPrompts[folder] ? { [folder]: customPrompts[folder] } : undefined,
            }),
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
    if (selectedFolders.size === 0) return
    if (!hasProductContext()) return
    setGeneratingImages(true)
    setJobs([])
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
              templateFolders: Array.from(selectedFolders),
              ...getProductPayload(),
              model,
              imageUrls: leftTab === 'pod' ? (podMockup?.url ? [podMockup.url] : undefined) : (uploadedUrls.length > 0 ? uploadedUrls : undefined),
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

  // --- Email helpers ---
  const allEmailSectionsList = Object.values(emailSections).flat()
  const filteredEmailSections = emailSections[emailSectionFilter] ?? []

  function toggleEmailSection(section: EmailSection) {
    setSelectedEmailSections(prev => {
      const existing = prev.find(s => s.folder === section.folder)
      if (existing) return prev.filter(s => s.folder !== section.folder)
      return [...prev, section]
    })
  }

  function pollEmailJob(taskId: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status?taskId=${taskId}`)
      const data = await res.json()
      setEmailJobs(prev => {
        const next = prev.map(j =>
          j.taskId === taskId
            ? { ...j, status: data.status ?? j.status, imageUrl: data.imageUrl ?? j.imageUrl }
            : j
        )
        if (data.status === 'success' && data.imageUrl) {
          const job = next.find(j => j.taskId === taskId)
          if (job) {
            const sectionType = job.sectionFolder.replace(/-\d+$/, '')
            saveToEmailGallery([{
              sectionFolder: job.sectionFolder,
              sectionType,
              imageUrl: data.imageUrl,
              savedAt: Date.now(),
            }])
          }
        }
        return next
      })
      if (data.status === 'success' || data.status === 'fail') clearInterval(interval)
    }, 5000)
  }

  async function generateEmailPrompt(sectionFolder: string) {
    if (!selectedProduct && !podContext) return
    setGeneratingEmailPromptFor(prev => new Set(prev).add(sectionFolder))
    try {
      const section = allEmailSectionsList.find(s => s.folder === sectionFolder)
      if (!section) return
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: [{ sectionFolder: `${section.sectionType}/${sectionFolder}` }],
          ...(podContext ? { podContext } : { productSlug: selectedProduct }),
          model,
          imageUrls: leftTab === 'pod' ? (podMockup?.url ? [podMockup.url] : undefined) : (uploadedUrls.length > 0 ? uploadedUrls : undefined),
        }),
      })
      const data = await res.json()
      const job = data.jobs?.[0]
      if (job?.filledPrompt) {
        setEmailCustomPrompts(prev => ({ ...prev, [sectionFolder]: job.filledPrompt }))
      }
    } catch (err) {
      console.error('generateEmailPrompt failed:', err)
    } finally {
      setGeneratingEmailPromptFor(prev => { const n = new Set(prev); n.delete(sectionFolder); return n })
    }
  }

  async function generateEmailImage(sectionFolder: string) {
    if (!selectedProduct && !podContext) return
    const section = allEmailSectionsList.find(s => s.folder === sectionFolder)
    if (!section) return
    const fullSectionFolder = `${section.sectionType}/${sectionFolder}`
    setGeneratingEmailImageFor(prev => new Set(prev).add(sectionFolder))
    setEmailJobs(prev => {
      const existing = prev.find(j => j.sectionFolder === sectionFolder)
      if (existing) return prev.map(j => j.sectionFolder === sectionFolder ? { ...j, status: 'pending', imageUrl: undefined, error: undefined, taskId: null } : j)
      return [...prev, { sectionFolder, taskId: null, status: 'pending' }]
    })
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: [{
            sectionFolder: fullSectionFolder,
            refEmailFolder: selectedRefEmail ?? undefined,
            filledPrompt: emailCustomPrompts[sectionFolder] ?? undefined,
          }],
          ...(podContext ? { podContext } : { productSlug: selectedProduct }),
          model,
          imageUrls: leftTab === 'pod' ? (podMockup?.url ? [podMockup.url] : undefined) : (uploadedUrls.length > 0 ? uploadedUrls : undefined),
        }),
      })
      const data = await res.json()
      const job: EmailJob = data.jobs?.[0]
      if (job) {
        setEmailJobs(prev => prev.map(j =>
          j.sectionFolder === sectionFolder
            ? { ...j, ...job, status: job.error ? 'error' : job.taskId ? 'pending' : 'error' }
            : j
        ))
        if (job.taskId) pollEmailJob(job.taskId)
      }
    } catch (err) {
      console.error('generateEmailImage failed:', err)
    } finally {
      setGeneratingEmailImageFor(prev => { const n = new Set(prev); n.delete(sectionFolder); return n })
    }
  }

  async function generateAllEmailImages() {
    if (selectedEmailSections.length === 0) return
    if (!selectedProduct && !podContext) return
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections: selectedEmailSections.map(s => ({
            sectionFolder: `${s.sectionType}/${s.folder}`,
            refEmailFolder: selectedRefEmail ?? undefined,
            filledPrompt: emailCustomPrompts[s.folder] ?? undefined,
          })),
          ...(podContext ? { podContext } : { productSlug: selectedProduct }),
          model,
          imageUrls: leftTab === 'pod' ? (podMockup?.url ? [podMockup.url] : undefined) : (uploadedUrls.length > 0 ? uploadedUrls : undefined),
        }),
      })
      const data = await res.json()
      const initialJobs: EmailJob[] = (data.jobs ?? []).map((j: EmailJob) => ({
        ...j,
        sectionFolder: j.sectionFolder.includes('/') ? j.sectionFolder.split('/').pop()! : j.sectionFolder,
        status: j.error ? 'error' : j.taskId ? 'pending' : 'error',
      }))
      setEmailJobs(initialJobs)
      const promptUpdates: Record<string, string> = {}
      initialJobs.forEach(job => { if (job.filledPrompt) promptUpdates[job.sectionFolder] = job.filledPrompt })
      if (Object.keys(promptUpdates).length > 0) setEmailCustomPrompts(prev => ({ ...prev, ...promptUpdates }))
      initialJobs.forEach(job => { if (job.taskId) pollEmailJob(job.taskId) })
    } catch (err) {
      console.error('generateAllEmailImages failed:', err)
    }
  }

  const hasOutput = selectedFolders.size > 0 || jobs.length > 0 || Object.keys(customPrompts).length > 0
  const hasPrompts = Object.keys(customPrompts).length > 0
  const loading = generatingPrompts || generatingImages
  const hasImages = leftTab === 'pod' ? (podMockup?.url != null) : (refImages.length > 0 && !uploading)
  const allPromptsReady = selectedFolders.size > 0 && Array.from(selectedFolders).every(f => !!customPrompts[f])

  return (
    <div className="h-screen bg-[#111111] flex flex-col font-sans overflow-hidden">

      {/* TOP NAVBAR */}
      <div className="h-[48px] shrink-0 bg-[#0d0d0d] border-b border-white/8 flex items-center px-4 gap-6">
        <span className="text-2xl leading-none select-none">💸</span>
        <div className="flex items-center gap-1">
          {([
            { id: 'dropshipping', label: 'Dropship' },
            { id: 'pod', label: 'POD' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setLeftTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                leftTab === tab.id
                  ? 'bg-white/12 text-white border border-white/15'
                  : 'text-white/40 hover:text-white/75 hover:bg-white/6'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="w-[20%] shrink-0 border-r border-white/8 flex flex-col bg-[#111111] overflow-hidden">

          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden">

          {/* Dropshipping: Upload img */}
          {leftTab === 'dropshipping' && (
            <div className="px-4 pt-4 pb-4 flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Product image</p>
              <label
                className={`flex flex-col w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors p-2 ${
                  dragOver ? 'border-white/40 bg-white/8' : 'border-white/12 bg-white/4 hover:border-white/15'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              >
                <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files && handleFiles(e.target.files)} />
                <div className={`flex flex-col items-center justify-center gap-2 py-4 ${refImages.length > 0 ? 'hidden' : ''}`}>
                  <svg className="w-6 h-6 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                  </svg>
                  <span className="text-[10px] text-white/35 font-medium leading-snug">Upload img <span className="text-white/25">· optional · up to 14</span></span>
                </div>
                {refImages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {refImages.map((img, i) => (
                      <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden bg-white/6 shrink-0 group">
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
                {uploading && <p className="text-[10px] text-white/30 mt-1">Uploading…</p>}
              </label>
              {!uploading && refImages.length === 0 && selectedFolders.size > 0 && (
                <p className="text-[10px] text-amber-600 font-medium">⚠ Add a product image to generate</p>
              )}
            </div>
          )}

          {/* Dropshipping: URL Analyzer */}
          {leftTab === 'dropshipping' && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Product DNA</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Paste product page URL..."
                  className="flex-1 bg-white/5 border border-white/12 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && analyzeUrl()}
                />
                <button
                  onClick={analyzeUrl}
                  disabled={analyzingUrl || !urlInput.trim()}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors bg-white/10 text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {analyzingUrl ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analyzing…</span>
                    </div>
                  ) : 'Analyze'}
                </button>
              </div>
              {dnaError && (
                <p className="text-[11px] text-red-400 leading-snug">{dnaError}</p>
              )}
              {generatedDna && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-green-400 font-medium">DNA generated</span>
                    <button
                      onClick={() => { setGeneratedDna(null); setUrlInput(''); setDnaError(null) }}
                      className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    value={generatedDna.combined}
                    onChange={e => setGeneratedDna({ ...generatedDna, combined: e.target.value })}
                    className="w-full bg-white/5 border border-white/12 rounded-lg px-3 py-2 text-[11px] text-white/70 leading-relaxed outline-none focus:border-white/25 transition-colors resize-none"
                    rows={20}
                  />
                </div>
              )}
            </div>
          )}

          {/* Dropshipping: Filters — hidden, reserved for new feature */}
          {false && leftTab === 'dropshipping' && (
            <div className="px-5 pt-4 pb-3 overflow-y-auto flex-1">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Format</p>
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
                          ? 'bg-[#1a2e1a] border-[#4caf50]/40 text-white font-semibold'
                          : 'bg-white/5 border-transparent text-white/55 hover:bg-white/8'
                      }`}
                    >
                      <span className="text-[13px] leading-tight truncate">{f.label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] tabular-nums shrink-0 ${active ? 'text-white/40' : 'text-white/25'}`}>
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
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Mockup</p>

              {/* Mockup drop zone */}
              <label
                className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
                  podDragOver ? 'border-[#4caf50] bg-[#1a2e1a]' : 'border-white/15 hover:border-white/30'
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
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/60 flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                    <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                    <p className="text-xs text-white/35 font-medium">Drop mockup here</p>
                    <p className="text-[11px] text-white/20">or click to browse</p>
                  </div>
                )}
              </label>

              {/* Optional description */}
              <textarea
                value={podDescription}
                onChange={e => setPodDescription(e.target.value)}
                placeholder="Optional: product name, price, target audience…"
                rows={2}
                className="w-full text-xs rounded-lg border border-white/12 bg-white/4 px-3 py-2 text-white/70 resize-none placeholder:text-white/25 focus:outline-none focus:border-white/25"
              />

              {/* Extract button */}
              <button
                onClick={extractPodContext}
                disabled={!podMockup || podMockupUploading || extractingContext}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#4caf50] px-3 py-2 text-xs font-semibold text-[#81c784] hover:bg-[#1a2e1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {extractingContext ? (
                  <><div className="w-3 h-3 border border-[#4caf50] border-t-transparent rounded-full animate-spin" /> Extracting…</>
                ) : podContext ? '↻ Re-extract context' : 'Extract context from mockup'}
              </button>

              {/* Extracted context (editable) */}
              {podContext && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Extracted Context</p>
                  <textarea
                    value={podContext}
                    onChange={e => setPodContext(e.target.value)}
                    rows={7}
                    className="w-full text-xs rounded-lg border border-[#4caf50]/40 bg-[#1a2e1a] px-3 py-2 text-white/70 resize-none focus:outline-none focus:border-[#4caf50]/60"
                  />
                  <p className="text-[10px] text-white/30">Edit above to refine before generating prompts.</p>
                </div>
              )}

              {/* Note for re-extraction */}
              {podContext && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Note</p>
                  <textarea
                    value={podNote}
                    onChange={e => setPodNote(e.target.value)}
                    placeholder="Add corrections or extra details, then press Re-extract context…"
                    rows={3}
                    className="w-full text-xs rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white/70 resize-none focus:outline-none focus:border-white/30 placeholder:text-white/20"
                  />
                </div>
              )}
            </div>
          )}
          {/* Email: section type filter chips */}
          {leftTab === 'email' && (
            <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Section Type</p>
              <div className="flex flex-col gap-1.5">
                {[...Object.keys(emailSections)].sort((a, b) => a === 'hero' ? -1 : b === 'hero' ? 1 : a.localeCompare(b)).map(type => {
                  const count = emailSections[type]?.length ?? 0
                  return (
                    <button
                      key={type}
                      onClick={() => setEmailSectionFilter(type)}
                      className={`flex items-center justify-between gap-1 rounded-lg px-3 py-2 transition-colors text-left border ${
                        emailSectionFilter === type
                          ? 'bg-[#1a2236] border-[#4c7caf]/40 text-white font-semibold'
                          : 'bg-white/5 border-transparent text-white/55 hover:bg-white/8'
                      }`}
                    >
                      <span className="text-sm capitalize">{type}</span>
                      <span className="text-[10px] tabular-nums text-white/25">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          </div>{/* end content area */}
        </div>

        {/* MIDDLE: Tabs */}
        <div className="w-[40%] flex flex-col min-w-0 border-r border-white/8 bg-[#111111]">
          {/* Tab bar */}
          <div className="h-[48px] border-b border-white/8 shrink-0 flex items-center px-4 gap-1">
            {leftTab !== 'email' && (['templates', 'gallery'] as const).map(tab => {
              const label = tab === 'templates' ? 'Templates' : `Gallery${galleryItems.length > 0 ? ` (${galleryItems.length})` : ''}`
              return (
                <button
                  key={tab}
                  onClick={() => setMidTab(tab)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                    midTab === tab
                      ? 'bg-white/10 border border-white/15 text-white'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              )
            })}
            {leftTab === 'email' && (
              <>
                {(['sections', 'gallery'] as const).map(tab => {
                  const label = tab === 'sections' ? 'Email Sections' : `Gallery${emailGalleryItems.length > 0 ? ` (${emailGalleryItems.length})` : ''}`
                  return (
                    <button
                      key={tab}
                      onClick={() => setEmailMidTab(tab)}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                        emailMidTab === tab
                          ? 'bg-white/10 border border-white/15 text-white'
                          : 'text-white/40 hover:text-white/80'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
                {emailMidTab === 'sections' && (
                  <span className="text-white/25 text-xs ml-auto">
                    {selectedEmailSections.length > 0 ? `${selectedEmailSections.length} selected` : ''}
                  </span>
                )}
              </>
            )}
            {leftTab !== 'email' && (
              <button
                onClick={() => { setShowNewTplModal(true); setNewTplFile(null); setNewTplFormat(''); setNewTplResult(null) }}
                className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-dashed border-white/15 text-white/40 hover:border-[#4caf50] hover:text-[#81c784] transition-colors"
              >
                + Add New Template
              </button>
            )}
          </div>

          {/* Email mode: two sub-cols — templates + ref emails */}
          {leftTab === 'email' && emailMidTab === 'sections' && (
            <div className="flex-1 overflow-hidden flex gap-0">
              {/* Left sub-col: section templates */}
              <div className="flex-1 overflow-y-auto p-3 border-r border-white/8">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Templates</p>
                <div className="flex flex-col gap-2">
                  {filteredEmailSections.length === 0 ? (
                    <p className="text-xs text-white/25 italic">No templates found</p>
                  ) : filteredEmailSections.map(s => {
                    const selected = selectedEmailSections.some(sel => sel.folder === s.folder)
                    return (
                      <button
                        key={s.folder}
                        onClick={() => toggleEmailSection(s)}
                        className={`relative rounded-md overflow-hidden border-2 text-left transition-all bg-white/5 ${
                          selected ? 'border-[#4c7caf]' : 'border-transparent hover:border-white/15'
                        }`}
                      >
                        {(s.refImg || s.previewImg) ? (
                          <div className={`grid ${s.refImg && s.previewImg ? 'grid-cols-2' : 'grid-cols-1'} gap-2 p-2`}>
                            {s.refImg && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.refImg} alt={s.folder} className="w-full h-auto block" />
                            )}
                            {s.previewImg && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.previewImg} alt={`${s.folder} preview`} className="w-full h-auto block" />
                            )}
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/5] bg-white/8 flex items-center justify-center text-white/20 text-xs">No preview</div>
                        )}
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold text-white truncate">{s.folder}</p>
                          <p className="text-[10px] text-white/40 capitalize">{s.sectionType} · {s.ratio}</p>
                        </div>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#4c7caf] rounded-full flex items-center justify-center shadow">
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

              {/* Right sub-col: reference emails — inspiration only, no interactions */}
              <div className="w-[45%] shrink-0 overflow-y-auto p-3">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Ref Emails</p>
                <div className="grid grid-cols-2 gap-2">
                  {referenceEmails.map(email => (
                    <div key={email.folder} className="rounded-md overflow-hidden bg-white/5">
                      {email.refImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={email.refImg} alt={email.folder} className="w-full h-auto block" />
                      ) : (
                        <div className="w-full aspect-[4/5] bg-white/8 flex items-center justify-center text-white/20 text-[10px]">No img</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Email Gallery tab */}
          {leftTab === 'email' && emailMidTab === 'gallery' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {emailGalleryItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                  <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/35">No generated email images yet</p>
                  <p className="text-xs text-white/20">Generated images will appear here automatically</p>
                </div>
              ) : (
                <>
                  <div className="px-4 pt-4 pb-3 shrink-0">
                    <button
                      onClick={() => {
                        fetch('/api/download-zip', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ images: emailGalleryItems.map(g => ({ url: g.imageUrl, filename: `${g.sectionFolder}.png` })) }),
                        }).then(r => r.blob()).then(blob => {
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = 'email-gallery.zip'
                          a.click()
                        })
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/8 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download all as ZIP ({emailGalleryItems.length} images)
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[...emailGalleryItems].sort((a, b) => b.savedAt - a.savedAt).map(g => (
                        <div key={g.sectionFolder} className="flex flex-col gap-1">
                          <div className="relative rounded-md overflow-hidden border border-white/8 bg-white/5 cursor-zoom-in group">
                            <div onClick={() => setPreviewUrl(g.imageUrl)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={g.imageUrl} alt={g.sectionFolder} className="w-full h-auto block" />
                            </div>
                            <button
                              onClick={() => removeFromEmailGallery(g.sectionFolder)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-white/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-[11px] font-semibold text-white truncate capitalize">{g.sectionFolder}</p>
                          <p className="text-[10px] text-white/40 capitalize">{g.sectionType}</p>
                          <button
                            onClick={() => downloadImage(g.imageUrl, `${g.sectionFolder}.png`)}
                            className="w-full text-[11px] font-semibold text-white/50 hover:text-white border border-white/12 rounded-md py-1.5 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Templates tab */}
          {leftTab !== 'email' && midTab === 'templates' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-3 items-start">
                {filtered.map(t => {
                  const selected = selectedFolders.has(t.folder)
                  const name = t.folder.replace('template-prompt-', 'Template ').replace(/-/g, ' ')
                  return (
                    <button
                      key={t.folder}
                      onClick={() => toggleFolder(t.folder)}
                      className={`relative rounded-md overflow-hidden border-2 text-left transition-all bg-white/5 ${
                        selected ? 'border-[#4caf50]' : 'border-transparent hover:border-white/15'
                      }`}
                    >
                      {t.refImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.refImg} alt={t.folder} className="w-full h-auto block" />
                      ) : (
                        <div className="w-full aspect-square bg-white/8 flex items-center justify-center text-white/20 text-xs">No preview</div>
                      )}
                      <div className="px-2.5 py-2">
                        <p className="text-xs font-semibold text-white truncate">{name}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{t.ratio} · {t.adFormat || '—'}</p>
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
          {leftTab !== 'email' && midTab === 'gallery' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {galleryItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                  <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/35">No generated images yet</p>
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
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/8 transition-colors"
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
                            <div className="relative rounded-md overflow-hidden border border-white/8 bg-white/5 cursor-zoom-in group">
                              <div onClick={() => setPreviewUrl(g.imageUrl)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={g.imageUrl} alt={g.folder} className="w-full h-auto block" />
                              </div>
                              <button
                                onClick={() => removeFromGallery(g.folder)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-white/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-[11px] font-semibold text-white truncate">{name}</p>
                            <p className="text-[10px] text-white/40">{g.ratio} · {g.adFormat || '—'}</p>
                            <button
                              onClick={() => downloadImage(g.imageUrl, `${g.folder}.png`)}
                              className="w-full text-[11px] font-semibold text-white/50 hover:text-white border border-white/12 rounded-md py-1.5 transition-colors"
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
        <div className="w-[40%] flex flex-col bg-[#111111]">
          {/* Header — email mode */}
          {leftTab === 'email' && (
            <div className="px-4 py-3 border-b border-white/8 flex gap-3 shrink-0 min-h-0">
              {/* Col 1: Product selector */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {products.length === 0 ? (
                  <p className="text-xs text-white/30 italic">No products found</p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-white/12 bg-[#1a1a1a] px-3 py-1.5 pr-7 text-xs font-medium text-white capitalize cursor-pointer focus:outline-none focus:border-[#4c7caf]/60 transition-colors"
                    >
                      {products.map(p => (
                        <option key={p} value={p} className="capitalize">{p}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                {selectedRefEmail && (
                  <p className="text-[10px] text-white/40">Ref: {selectedRefEmail}</p>
                )}
                <label
                  className={`flex flex-col w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors p-2 ${
                    dragOver ? 'border-white/40 bg-white/8' : 'border-white/12 bg-white/4 hover:border-white/15'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                >
                  <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files && handleFiles(e.target.files)} />
                  <div className={`flex items-center justify-center gap-1.5 py-0.5 ${refImages.length > 0 ? 'hidden' : ''}`}>
                    <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                    </svg>
                    <span className="text-[10px] text-white/35 font-medium leading-snug">Upload img <span className="text-white/25">· optional · up to 14</span></span>
                  </div>
                  {refImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {refImages.map((img, i) => (
                        <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden bg-white/6 shrink-0 group">
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
                  {uploading && <p className="text-[10px] text-white/30 mt-1">Uploading…</p>}
                </label>
              </div>
              {/* Col 2: Generate prompts + Model */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <button
                  onClick={() => selectedEmailSections.forEach(s => generateEmailPrompt(s.folder))}
                  disabled={selectedEmailSections.length === 0 || !selectedProduct || generatingEmailPromptFor.size > 0}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#4caf50]/60 px-3 py-2 text-xs font-semibold text-[#81c784] disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-[#1a2e1a]"
                >
                  {generatingEmailPromptFor.size > 0 ? (
                    <><div className="w-3 h-3 border border-[#81c784] border-t-transparent rounded-full animate-spin" /> Generating…</>
                  ) : 'Generate prompts'}
                </button>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full text-xs bg-[#1a1a1a] border border-white/12 rounded-lg px-2.5 py-2 text-white/70 appearance-none cursor-pointer"
                >
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5 — fast</option>
                  <option value="claude-sonnet-4-6">Sonnet 4.6 — quality</option>
                </select>
              </div>
              {/* Col 3: Generate all */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={generateAllEmailImages}
                  disabled={selectedEmailSections.length === 0 || !selectedProduct}
                  className="w-full h-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-transparent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-70 disabled:cursor-not-allowed transition-colors bg-[#4c7caf] hover:bg-[#3d6d9e]"
                >
                  Generate all
                </button>
              </div>
            </div>
          )}

          {/* Header — 3 columns (Drop/POD mode) */}
          {leftTab !== 'email' && (
          <div className="px-4 py-3 border-b border-white/8 flex gap-3 shrink-0">

            {/* Col 1: Product selector (Dropshipping) OR POD status */}
            {leftTab === 'dropshipping' ? (
              <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                {generatedDna && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#4caf50] shrink-0" />
                    <span className="text-xs text-[#81c784] font-medium">DNA from URL</span>
                  </div>
                )}
              </div>
            ) : (
              /* POD mode col 1: status indicators */
              <div className="flex-1 flex flex-col justify-center gap-2.5 min-w-0">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">POD Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${podMockup?.url ? 'bg-[#4caf50]' : podMockupUploading ? 'bg-yellow-400' : 'bg-black/15'}`} />
                  <span className="text-xs text-white/60">
                    {podMockupUploading ? 'Uploading mockup…' : podMockup?.url ? 'Mockup ready' : 'No mockup — upload in sidebar'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${podContext ? 'bg-[#4caf50]' : 'bg-black/15'}`} />
                  <span className="text-xs text-white/60">
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
                disabled={generatingPrompts || selectedFolders.size === 0 || !hasProductContext()}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#4caf50] px-3 py-1.5 text-xs font-semibold text-[#81c784] hover:bg-[#1a2e1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                className="w-full text-xs bg-[#1a1a1a] border border-white/12 rounded-lg px-2.5 py-2 text-white/70 appearance-none cursor-pointer"
              >
                <option value="claude-haiku-4-5-20251001">Haiku 4.5 — fast</option>
                <option value="claude-sonnet-4-6">Sonnet 4.6 — quality</option>
              </select>
            </div>

            {/* Col 3: Generate Images */}
            <div className="relative group flex-1 min-w-0">
              <button
                onClick={generateImages}
                disabled={generatingImages || selectedFolders.size === 0 || !hasImages || !hasProductContext()}
                className={`w-full h-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-transparent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${
                  allPromptsReady && hasImages
                    ? 'bg-[#4caf50] hover:bg-[#43a047]'
                    : 'bg-white/15 hover:bg-white/20 border-white/15 hover:text-white'
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
          )}{/* end leftTab !== 'email' header */}

          {/* Email output content */}
          {leftTab === 'email' && (
            <div className="flex-1 overflow-y-auto p-4">
              {selectedEmailSections.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center">
                    <span className="text-2xl">✉️</span>
                  </div>
                  <p className="text-sm text-white/35 leading-snug max-w-[200px]">Select email sections from the middle panel to generate</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {selectedEmailSections.map(section => {
                    const job = emailJobs.find(j => j.sectionFolder === section.folder)
                    const promptText = emailCustomPrompts[section.folder] ?? job?.filledPrompt ?? section.promptBody ?? ''
                    const statusColor = !job ? 'text-white/30' : job.status === 'success' ? 'text-green-600' : job.status === 'fail' || job.error ? 'text-red-500' : 'text-yellow-600'
                    const statusLabel = !job ? '' : job.error ? 'Error' : job.status === 'success' ? 'Done' : job.status === 'fail' ? 'Failed' : 'Generating…'
                    const aspectClass = section.ratio === '9:16' ? 'aspect-[9/16]' : section.ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'
                    return (
                      <div key={section.folder} className="py-4 first:pt-0">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-xs font-bold text-white">{section.folder}</p>
                          <span className="text-[10px] text-white/25">·</span>
                          <span className="text-[10px] text-white/35 capitalize">{section.sectionType} · {section.ratio}</span>
                          <span className={`text-[10px] font-semibold ml-auto ${statusColor}`}>{statusLabel}</span>
                          <button
                            onClick={() => toggleEmailSection(section)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-400 bg-red-500/15 shrink-0"
                          >
                            ❌ Clear
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-start">
                          {/* Col 1: Preview */}
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Preview</p>
                            <div className="rounded-md overflow-hidden border border-white/8 bg-white/5">
                              {section.refImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={section.refImg} alt={section.folder} className="w-full h-auto block cursor-zoom-in" onClick={() => setPreviewUrl(section.refImg!)} />
                              ) : (
                                <div className={`${aspectClass} flex items-center justify-center bg-white/5`}>
                                  <p className="text-[11px] text-white/25 text-center px-3">No preview</p>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Col 2: Prompt */}
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Prompt</p>
                            <div className="rounded-md border border-dashed border-white/15 bg-white/5 p-3 flex flex-col gap-2 min-h-[80px]">
                              {promptText ? (
                                <p className="text-[11px] text-white/55 leading-relaxed whitespace-pre-wrap">{promptText}</p>
                              ) : (
                                <p className="text-[11px] text-white/25 italic">No prompt loaded</p>
                              )}
                            </div>
                            <button
                              onClick={() => generateEmailPrompt(section.folder)}
                              disabled={generatingEmailPromptFor.has(section.folder) || !selectedProduct}
                              className={`w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                                emailCustomPrompts[section.folder] || generatingEmailPromptFor.has(section.folder)
                                  ? 'border-[#4c7caf] text-[#7ca8d4] hover:bg-[#1a2236]'
                                  : 'border-white/15 text-white/50 hover:bg-white/8'
                              }`}
                            >
                              {generatingEmailPromptFor.has(section.folder) ? (
                                <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
                              ) : emailCustomPrompts[section.folder] ? '↻ Regenerate' : 'Generate prompt'}
                            </button>
                          </div>
                          {/* Col 3: Output */}
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Output</p>
                            <div className="rounded-md overflow-hidden border border-white/8 bg-white/5">
                              {job?.imageUrl ? (
                                <>
                                  <div className={`relative w-full ${aspectClass} cursor-zoom-in`} onClick={() => setPreviewUrl(job.imageUrl!)}>
                                    <Image src={job.imageUrl} alt={section.folder} fill className="object-contain" unoptimized />
                                  </div>
                                  <div className="px-3 py-2.5">
                                    <button
                                      onClick={() => downloadImage(job.imageUrl!, `${section.folder}.png`)}
                                      className="w-full bg-white/15 text-white text-xs font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors"
                                    >
                                      Save image
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className={`${aspectClass} flex items-center justify-center bg-white/5`}>
                                  {job && !job.error ? (
                                    <div className="w-6 h-6 border-2 border-white/15 border-t-black/60 rounded-full animate-spin" />
                                  ) : job?.error ? (
                                    <p className="text-xs text-red-400 px-3 text-center">{job.error}</p>
                                  ) : (
                                    <p className="text-[11px] text-white/25 text-center px-3">Generate to create image</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => generateEmailImage(section.folder)}
                              disabled={generatingEmailImageFor.has(section.folder) || !selectedProduct}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/15 border-2 border-transparent py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {generatingEmailImageFor.has(section.folder) ? (
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
          )}

          {/* Drop/POD output content */}
          {leftTab !== 'email' && (
          <div className="flex-1 overflow-y-auto p-4">
            {!hasOutput ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                  </svg>
                </div>
                <p className="text-sm text-white/35 leading-snug max-w-[180px]">Pick templates, generate prompts, then create images</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {Array.from(selectedFolders).map(folder => {
                  const tpl = templates.find(t => t.folder === folder)
                  const job = jobs.find(j => j.folder === folder)
                  const ratio = tpl?.ratio ?? '1:1'
                  const aspectClass = ratio === '9:16' ? 'aspect-[9/16]' : ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'
                  const name = folder.replace('template-prompt-', 'Template ')
                  const promptText = customPrompts[folder] ?? job?.filledPrompt ?? tpl?.promptBody ?? ''
                  const statusColor = !job ? 'text-white/30' : job.status === 'success' ? 'text-green-600' : job.status === 'fail' || job.error ? 'text-red-500' : 'text-yellow-600'
                  const statusLabel = !job ? 'Ready' : job.error ? 'Error' : job.status === 'success' ? 'Done' : job.status === 'fail' ? 'Failed' : 'Generating…'
                  return (
                    <div key={folder} className="py-4 first:pt-0">
                      {/* Row header */}
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-white">{name}</p>
                        <span className="text-[10px] text-white/25">·</span>
                        <span className="text-[10px] text-white/35">{ratio} · {tpl?.adFormat || '—'}</span>
                        <span className={`text-[10px] font-semibold ml-auto ${statusColor}`}>{statusLabel !== 'Ready' ? statusLabel : ''}</span>
                        <button
                          onClick={() => toggleFolder(folder)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-400 bg-red-500/15 shrink-0"
                        >
                          ❌ Clear
                        </button>
                      </div>

                      {/* 3-column: preview | prompt | outcome */}
                      <div className="grid grid-cols-3 gap-3 items-start">

                        {/* Col 1: Template preview img */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Preview</p>
                          <div className="rounded-md overflow-hidden border border-white/8 bg-white/5">
                            {tpl?.refImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={tpl.refImg} alt={folder} className="w-full h-auto block cursor-zoom-in" onClick={() => setPreviewUrl(tpl.refImg!)} />
                            ) : (
                              <div className={`${aspectClass} flex items-center justify-center bg-white/5`}>
                                <p className="text-[11px] text-white/25 text-center px-3">No preview</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Col 2: Prompt */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Prompt</p>
                          <div className="rounded-md border border-dashed border-white/15 bg-white/5 p-3 flex flex-col gap-2 min-h-[80px]">
                            {promptText ? (
                              <p className="text-[11px] text-white/55 leading-relaxed whitespace-pre-wrap">{promptText}</p>
                            ) : (
                              <p className="text-[11px] text-white/25 italic">No prompt loaded</p>
                            )}
                          </div>
                          <button
                            onClick={() => generateSinglePrompt(folder)}
                            disabled={generatingPromptFor.has(folder) || !hasProductContext()}
                            className={`w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                              customPrompts[folder] || generatingPromptFor.has(folder)
                                ? 'border-[#4caf50] text-[#81c784] hover:bg-[#1a2e1a]'
                                : 'border-white/15 text-white/50 hover:bg-white/8'
                            }`}
                          >
                            {generatingPromptFor.has(folder) ? (
                              <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
                            ) : customPrompts[folder] ? '↻ Regenerate' : 'Generate prompt'}
                          </button>
                        </div>

                        {/* Col 3: Outcome image */}
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Output</p>
                          <div className="rounded-md overflow-hidden border border-white/8 bg-white/5">
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
                                    className="w-full bg-white/15 text-white text-xs font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors"
                                  >
                                    Save image
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className={`${aspectClass} flex items-center justify-center bg-white/5`}>
                                {job && !job.error ? (
                                  <div className="w-6 h-6 border-2 border-white/15 border-t-black/60 rounded-full animate-spin" />
                                ) : job?.error ? (
                                  <p className="text-xs text-red-400 px-3 text-center">{job.error}</p>
                                ) : (
                                  <p className="text-[11px] text-white/25 text-center px-3">Generate to create image</p>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => generateSingleImage(folder)}
                            disabled={generatingImageFor.has(folder) || !hasImages}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/15 border-2 border-transparent py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          )}{/* end leftTab !== 'email' output */}
        </div>

      </div>

      {/* Add New Template modal */}
      {showNewTplModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !creatingTemplate && setShowNewTplModal(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-[420px] p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Add New Template</h2>
              <button
                onClick={() => !creatingTemplate && setShowNewTplModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/6 hover:bg-black/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image drop zone */}
            <label
              className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
                newTplDragOver ? 'border-[#4caf50] bg-[#1a2e1a]' : 'border-white/15 hover:border-white/30'
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
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/60 flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 px-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
                  </svg>
                  <p className="text-sm font-medium text-white/35">Drop reference ad image here</p>
                  <p className="text-xs text-white/25">or click to browse · JPG, PNG, WEBP</p>
                </div>
              )}
            </label>

            {/* Ad format selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Ad Format</label>
              <select
                value={newTplFormat}
                onChange={e => setNewTplFormat(e.target.value)}
                className={`w-full rounded-lg border border-white/12 px-3 py-2 text-sm bg-[#1a1a1a] appearance-none cursor-pointer focus:outline-none focus:border-white/30 ${newTplFormat ? 'text-white' : 'text-white/40'}`}
              >
                <option value="" disabled>Select ad format…</option>
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
              <p className={`text-xs font-medium ${newTplResult.startsWith('Error') ? 'text-red-500' : 'text-[#81c784]'}`}>
                {newTplResult}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => !creatingTemplate && setShowNewTplModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/12 text-sm font-semibold text-white/50 hover:bg-white/8 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTemplate}
                disabled={!newTplFile || !newTplFormat || creatingTemplate}
                className="flex-1 py-2 rounded-lg bg-[#4caf50] text-white text-sm font-semibold hover:bg-[#43a047] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
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
