

import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useState } from 'react'
// Type-only import — erased at compile time, so pulling pdfjs-dist in
// through pdfLoader stays a runtime-only cost paid lazily below.
import { DropOverlay } from './DropOverlay'
import { ErrorToast } from './ErrorToast'
import { LoadingOverlay } from './LoadingOverlay'
import { PageNavButtons } from './PageNavButtons'
import type { LoadedPdf } from './pdfLoader'
import { PdfOverlay } from './PdfOverlay'
import { SceneHint } from './SceneHint'
import { SceneContent } from './three/SceneContent'

// Default book that ships with the site. BOOK_DIR is the subfolder name
// you passed to scripts/pdf-to-pages.sh (under public/), and
// DEFAULT_BOOK_PAGE_COUNT is the total number of pages in that PDF.
// A sheet is two pages, so physicalSheets = ceil(pages / 2). Any missing
// image slot falls back to a rendered page number, so you can safely
// tweak these before the files exist.
const DEFAULT_BOOK_DIR = 'cv_stepanrutz'
const DEFAULT_BOOK_PAGE_COUNT = 4
const DEFAULT_BOOK_PDF_URL = `${import.meta.env.BASE_URL}${DEFAULT_BOOK_DIR}/${DEFAULT_BOOK_DIR}.pdf`
const defaultPageImages = Array.from(
  { length: DEFAULT_BOOK_PAGE_COUNT },
  (_, i) => `${import.meta.env.BASE_URL}${DEFAULT_BOOK_DIR}/page-${String(i + 1).padStart(3, '0')}.png`,
)

// Keep the browser-side PDF loader honest — rasterizing every page to
// a PNG at 1024px eats memory fast, and a CV or a pitch deck almost
// never needs more than this anyway.
export const MAX_USER_PDF_PAGES = 48



export function BookContainer({ onPdfInfo, onPickFileRef, zen, useCovers, frontTextOverride, backTextOverride, coverColor, maxPages: maxPagesProp = MAX_USER_PDF_PAGES }: { onPdfInfo?: (info: { url: string; filename: string }) => void; onPickFileRef?: React.RefObject<((file: File) => void) | null>; zen?: boolean; useCovers?: boolean; frontTextOverride?: string; backTextOverride?: string; coverColor?: string; maxPages?: number }) {
  const [overlayPage, setOverlayPage] = useState<number | null>(null)
  const [customBook, setCustomBook] = useState<LoadedPdf | null>(null)
  const [loading, setLoading] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // Revoke the custom book's blob URLs when it's replaced or the
  // component unmounts. Tied to customBook identity so a new upload
  // cleans up the previous one automatically. We dynamic-import
  // pdfLoader so casual visitors who never upload a PDF don't pay
  // the pdfjs-dist bundle cost.
  useEffect(() => {
    if (!customBook) return
    return () => {
      import('./pdfLoader').then(({ revokeLoadedPdf }) => revokeLoadedPdf(customBook))
    }
  }, [customBook])

  const rawPageCount = customBook?.pageCount ?? DEFAULT_BOOK_PAGE_COUNT
  const rawPageImages = customBook?.pageImages ?? defaultPageImages
  const pdfUrl = customBook?.pdfUrl ?? DEFAULT_BOOK_PDF_URL
  const pdfFilename = customBook
    ? `${customBook.name}.pdf`
    : `${DEFAULT_BOOK_DIR}.pdf`
  const frontCoverText = frontTextOverride ?? (customBook ? customBook.name : 'Stepan Rutz')
  const backCoverInnerText = backTextOverride ?? (customBook ? null : 'stepan.rutz@stepanrutz.com')

  // When useCovers is on, pull the first and last page images onto the
  // cover faces and remove them from the interior page list.
  const canUseCovers = useCovers && rawPageImages.length >= 2
  const frontCoverOuterImage = canUseCovers ? (rawPageImages[0] ?? null) : null
  const backCoverOuterImage = canUseCovers ? (rawPageImages[rawPageImages.length - 1] ?? null) : null
  const pageImages = canUseCovers ? rawPageImages.slice(1, -1) : rawPageImages
  const pageCount = canUseCovers ? Math.max(0, rawPageCount - 2) : rawPageCount

  useEffect(() => {
    onPdfInfo?.({ url: pdfUrl, filename: pdfFilename })
  }, [pdfUrl, pdfFilename, onPdfInfo])

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }
    setError(null)
    setLoading({ current: 0, total: 0 })
    try {
      // Lazy-load pdfjs-dist — it's a ~1 MB dep we'd rather not ship
      // to visitors who only ever read the default book.
      const { loadPdfAsBook } = await import('./pdfLoader')
      const loaded = await loadPdfAsBook(file, maxPagesProp, (cur, total) => {
        setLoading({ current: cur, total })
      })
      // setCustomBook's cleanup effect will revoke the previous one for us.
      setCustomBook(loaded)
      if (loaded.truncated) {
        setError(
          `Only the first ${loaded.pageCount} of ${loaded.totalPages} pages were rendered.`,
        )
      }
      // If the overlay was showing a page from the previous PDF, close it.
      setOverlayPage(null)
    } catch (err) {
      console.error('Failed to load PDF', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF.')
    } finally {
      setLoading(null)
    }
  }, [maxPagesProp])

  // Expose handleFile to the parent via ref so the sidebar can trigger uploads.
  useEffect(() => {
    if (onPickFileRef) {
      (onPickFileRef as React.MutableRefObject<((file: File) => void) | null>).current = handleFile
    }
  }, [handleFile, onPickFileRef])

  // On first mount, honor a ?pdf=<url> or ?proxypdf=<url> query parameter
  // by fetching that PDF and loading it through the same rasterizer the
  // drop/upload path uses. ?pdf= fetches directly (needs CORS on the remote
  // server); ?proxypdf= routes through the Cloudflare CORS proxy worker.
  // Optional params: ?name=<title> sets the front cover text,
  // ?maxpages=<n> overrides the page limit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const directUrl = params.get('pdf')
    const proxyUrl = params.get('proxypdf')
    const pdfParam = directUrl
      ?? (proxyUrl ? `https://pdf-cors-proxy.srutz.workers.dev/?url=${encodeURIComponent(proxyUrl)}` : null)
    if (!pdfParam) return
    // When proxying, derive the display name from the original URL so the
    // book title isn't "document" or the proxy hostname.
    let nameFromUrl: string | undefined
    const nameParam = params.get('name')
    if (nameParam) {
      nameFromUrl = nameParam
    } else if (proxyUrl) {
      try {
        const last = new URL(proxyUrl).pathname.split('/').filter(Boolean).pop()
        if (last) nameFromUrl = decodeURIComponent(last).replace(/\.pdf$/i, '') || undefined
      } catch { /* ignore */ }
    }
    const maxPagesParam = params.get('maxpages') ?? params.get('maxPages')
    const maxPages = maxPagesParam ? Math.max(1, Math.min(300, parseInt(maxPagesParam, 10) || maxPagesProp)) : maxPagesProp
    let cancelled = false
      ; (async () => {
        setError(null)
        setLoading({ current: 0, total: 0 })
        try {
          const { loadPdfFromUrl, revokeLoadedPdf } = await import('./pdfLoader')
          const loaded = await loadPdfFromUrl(pdfParam, maxPages, (cur, total) => {
            if (!cancelled) setLoading({ current: cur, total })
          }, nameFromUrl)
          if (cancelled) {
            // Component unmounted mid-load — release the blob URLs we made.
            revokeLoadedPdf(loaded)
            return
          }
          setCustomBook(loaded)
          if (loaded.truncated) {
            setError(
              `Only the first ${loaded.pageCount} of ${loaded.totalPages} pages were rendered.`,
            )
          }
          setOverlayPage(null)
        } catch (err) {
          if (cancelled) return
          console.error('Failed to load PDF from URL', err)
          setError(err instanceof Error ? err.message : 'Failed to load PDF from URL.')
        } finally {
          if (!cancelled) setLoading(null)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [])

  // Full-window drag-and-drop. We listen on window rather than a
  // wrapper div so the Three.js canvas (which captures pointer events
  // for OrbitControls) doesn't steal the drop target.
  useEffect(() => {
    // Track enter/leave depth: dragenter fires for every child element
    // the cursor crosses, and a naive boolean flickers. Counting keeps
    // the overlay stable until the drag really leaves the window.
    let depth = 0
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      // preventDefault is what actually enables the drop.
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) handleFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [-2, 6, 6], fov: 28 }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <SceneContent
          pageCount={pageCount}
          pageImages={pageImages}
          frontCoverText={frontCoverText}
          backCoverInnerText={backCoverInnerText}
          frontCoverOuterImage={frontCoverOuterImage}
          backCoverOuterImage={backCoverOuterImage}
          coverColor={coverColor}
          onPageOpen={
            pdfUrl ? (pageNumber) => setOverlayPage(pageNumber) : undefined
          }
        />
      </Canvas>
      <PageNavButtons />
      {!zen && <SceneHint />}
      {dragging && !zen && <DropOverlay />}
      {loading && <LoadingOverlay current={loading.current} total={loading.total} />}
      {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
      {pdfUrl && overlayPage !== null && (
        <PdfOverlay
          url={pdfUrl}
          page={overlayPage}
          onClose={() => setOverlayPage(null)}
        />
      )}
    </>
  )
}
