

import { Center, ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaFilePdf, FaGithub, FaUpload } from 'react-icons/fa6'
import { Book } from './Book'
// Type-only import — erased at compile time, so pulling pdfjs-dist in
// through pdfLoader stays a runtime-only cost paid lazily below.
import type { LoadedPdf } from './pdfLoader'

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
const MAX_USER_PDF_PAGES = 48

function SceneContent({
  pageCount,
  pageImages,
  frontCoverText,
  backCoverInnerText,
  onPageOpen,
}: {
  pageCount: number
  pageImages: (string | null | undefined)[]
  frontCoverText: string
  backCoverInnerText: string | null
  onPageOpen?: (pageNumber: number) => void
}) {
  const shadows = true
  const sheetCount = Math.max(1, Math.ceil(pageCount / 2))
  return (
    <>
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <group position={[0, -0.25, 0]}>
        <Center top position={[1, 0.3, 0]} >
          <Book
            // Rebuild the Book outright when the source PDF changes,
            // so sheet textures don't hold onto revoked blob URLs from
            // the previous document.
            key={`${pageCount}:${pageImages[0] ?? ''}`}
            pageCount={sheetCount}
            pageImages={pageImages}
            onPageOpen={onPageOpen}
            rotation={[0.0, 0, 0]}
            frontCoverOuterText={frontCoverText}
            backCoverInnerText={backCoverInnerText ?? undefined}
          />
        </Center>
        {shadows && (
          // ContactShadows is a real-time shadow that re-renders every
          // frame, so it tracks the book as it opens / closes / flips.
          // AccumulativeShadows by contrast bakes once and freezes —
          // fine for static scenes, wrong for an animating book.
          <ContactShadows
            position={[0, 0.005, 0]}
            scale={10}
            resolution={1024}
            far={3}
            blur={2.5}
            opacity={0.6}
            color="#000000"
          />
        )}
      </group>
      <OrbitControls enablePan={true} minPolarAngle={0} maxPolarAngle={Math.PI / 2.25} />
    </>
  )
}

// Fullscreen HTML overlay that embeds the original PDF at a specific
// page using the browser's built-in viewer. Chrome (PDFium) and Firefox
// (PDF.js) both honor the `#page=N` / `#view=FitH` fragment from
// Adobe's "Open Parameters" spec, so the page is rendered as real
// vectors at display resolution — no PNG raster involved.
function PdfOverlay({
  url,
  page,
  onClose,
}: {
  url: string
  page: number
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const src = `${url}#page=${page}&view=FitH`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[min(95vw,900px)] h-[min(96vh,1200px)] bg-white shadow-2xl rounded overflow-hidden border border-zinc-400"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          key={src}
          src={src}
          title={`PDF page ${page}`}
          className="w-full h-full border-0"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white text-xl leading-none hover:bg-black/80"
          aria-label="Close PDF"
        >
          ×
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// Top-center overlay with prev/next page buttons. We dispatch the same
// PageUp/PageDown KeyboardEvents the Book component already listens for,
// so the buttons stay decoupled from the Book's internal step state.
function PageNavButtons() {
  const flip = (key: 'PageUp' | 'PageDown') => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 flex gap-2">
      <button
        type="button"
        onClick={() => flip('PageUp')}
        title="Previous page"
        aria-label="Previous page"
        className="px-[32px] py-2 bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow flex gap-2 items-center"
      >
        <FaArrowLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => flip('PageDown')}
        title="Next page"
        aria-label="Next page"
        className="px-[32px] py-2 bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow flex gap-2 items-center"
      >
        <FaArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

// Zen mode: the only chrome we keep besides the page-flip buttons is
// this tiny GitHub link tucked into the top-left corner.
function ZenGithubLink() {
  return (
    <a
      href="https://github.com/srutz/visualizer"
      target="_blank"
      rel="noopener noreferrer"
      title="Source code on GitHub"
      aria-label="Source code on GitHub"
      className="fixed top-2 left-2 z-40 p-1 text-white/60 hover:text-white/90"
    >
      <FaGithub className="w-5 h-5" />
    </a>
  )
}

function PdfDownloadButton({ url, filename }: { url: string; filename: string }) {
  return (
    <a
      href={url}
      download={filename}
      title="Download PDF"
      aria-label="Download PDF"
      className="fixed top-2 right-2 z-40 ">
      <div className="px-[64px] py-2 bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow flex gap-2">
        < FaFilePdf className="w-5 h-5" />
        Download PDF
      </div>
    </a>
  )
}

function Header({ onPickFile }: { onPickFile: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="fixed top-2 left-2 z-40 ">
      <div className="px-[64px] py-2 bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow flex flex-col gap-2 items-center">
        <div>
          Free PDF Visualizer by <a href="https://www.stepanrutz.com" target="_blank" rel="noopener noreferrer" className="underline">Stepan Rutz</a>
        </div>
        <a href="https://github.com/srutz/visualizer" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline"><FaGithub className="w-5 h-5" /> Sourceode </a>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 underline"
        >
          <FaUpload className="w-4 h-4" /> Load your own PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickFile(file)
            // Reset so picking the same file twice still fires change.
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function SceneHint() {
  const modKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl'
  return (
    <div className="min-w-[600px] fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="px-4 py-2 rounded-full bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow flex items-center justify-center">
        <span>Click/PageDown to flip</span>
        <span className="mx-3">·</span>
        <span>Shift+Click/PageUp to flip back</span>
        <span className="mx-3">·</span>
        <span>{modKey}+Click to open PDF-Page</span>
        <span className="mx-3">·</span>
        <span>Drop a PDF to load it</span>
      </div>
    </div>
  )
}

function DropOverlay() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
      <div className="px-10 py-8 rounded-2xl border-4 border-dashed border-white/80 text-white text-xl font-semibold flex flex-col items-center gap-3">
        <FaFilePdf className="w-10 h-10" />
        Drop your PDF to load it (max {MAX_USER_PDF_PAGES} pages)
      </div>
    </div>
  )
}

function LoadingOverlay({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="px-8 py-6 rounded-xl bg-zinc-900 text-white shadow-2xl flex flex-col gap-3 min-w-[280px]">
        <div className="text-sm">
          {total === 0
            ? 'Opening PDF…'
            : `Rendering page ${current} of ${total}…`}
        </div>
        <div className="h-2 w-full bg-zinc-700 rounded overflow-hidden">
          <div
            className="h-full bg-white transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(id)
  }, [onDismiss])
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg bg-red-700 text-white text-sm shadow-lg">
      {message}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-3 underline"
      >
        dismiss
      </button>
    </div>
  )
}

export function BookScene() {
  const [overlayPage, setOverlayPage] = useState<number | null>(null)
  const [customBook, setCustomBook] = useState<LoadedPdf | null>(null)
  const [loading, setLoading] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // ?mode=zen strips all chrome except the page-flip buttons and a
  // tiny GitHub link. Parsed once via a lazy useState initializer so
  // we don't re-read window.location on every render.
  const [isZen] = useState(
    () => new URLSearchParams(window.location.search).get('mode') === 'zen',
  )

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

  const pageCount = customBook?.pageCount ?? DEFAULT_BOOK_PAGE_COUNT
  const pageImages = customBook?.pageImages ?? defaultPageImages
  const pdfUrl = customBook?.pdfUrl ?? DEFAULT_BOOK_PDF_URL
  const pdfFilename = customBook
    ? `${customBook.name}.pdf`
    : `${DEFAULT_BOOK_DIR}.pdf`
  const frontCoverText = customBook ? customBook.name : 'Stepan Rutz'
  const backCoverInnerText = customBook ? null : 'stepan.rutz@stepanrutz.com'

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
      const loaded = await loadPdfAsBook(file, MAX_USER_PDF_PAGES, (cur, total) => {
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
  }, [])

  // On first mount, honor a ?pdf=<url> query parameter by fetching
  // that PDF and loading it through the same rasterizer the drop/upload
  // path uses. Cross-origin URLs require permissive CORS on the remote
  // server; otherwise fetch will fail and we surface the error.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pdfParam = params.get('pdf')
    if (!pdfParam) return
    let cancelled = false
      ; (async () => {
        setError(null)
        setLoading({ current: 0, total: 0 })
        try {
          const { loadPdfFromUrl, revokeLoadedPdf } = await import('./pdfLoader')
          const loaded = await loadPdfFromUrl(pdfParam, MAX_USER_PDF_PAGES, (cur, total) => {
            if (!cancelled) setLoading({ current: cur, total })
          })
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
          onPageOpen={
            pdfUrl ? (pageNumber) => setOverlayPage(pageNumber) : undefined
          }
        />
      </Canvas>
      {!isZen && <Header onPickFile={handleFile} />}
      {isZen && <ZenGithubLink />}
      <PageNavButtons />
      {!isZen && pdfUrl && <PdfDownloadButton url={pdfUrl} filename={pdfFilename} />}
      {!isZen && <SceneHint />}
      {dragging && !isZen && <DropOverlay />}
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
