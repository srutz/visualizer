

import { AccumulativeShadows, Center, OrbitControls, RandomizedLight } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Book } from './Book'

// Point these at whatever you rendered with scripts/pdf-to-pages.sh.
// BOOK_DIR is the subfolder name you passed to the script (it lives under
// public/), and BOOK_PAGE_COUNT is the total number of pages in the PDF.
// A book has two pages per sheet, so the number of physical sheets is
// ceil(BOOK_PAGE_COUNT / 2). Any missing image falls back to a rendered
// page number, so you can safely tweak these before the files exist.
const BOOK_DIR = 'cv_stepanrutz'
const BOOK_PAGE_COUNT = 3
// Optional original PDF. When set, double-clicking a page opens an
// HTML overlay with the browser's native PDF viewer at that page —
// perfect-quality vectors, no PNG rasterization. Set to null to
// disable the overlay feature.
const BOOK_PDF_URL: string | null = `/${BOOK_DIR}/${BOOK_DIR}.pdf`

const pageImages = Array.from(
  { length: BOOK_PAGE_COUNT },
  (_, i) => `/${BOOK_DIR}/page-${String(i + 1).padStart(3, '0')}.png`,
)
const sheetCount = Math.ceil(BOOK_PAGE_COUNT / 2)

function SceneContent({
  onPageDoubleClick,
}: {
  onPageDoubleClick?: (pageNumber: number) => void
}) {
  const { shadow } = { shadow: '#888888' }
  const shadows = !false
  return (
    <>
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <group position={[0, -0.25, 0]}>
        <Center top position={[0, 0.3, 0]} >
          <Book
            pageCount={sheetCount}
            pageImages={pageImages}
            onPageDoubleClick={onPageDoubleClick}
          />
        </Center>
        {shadows && (
          <AccumulativeShadows temporal frames={100} color={shadow} opacity={1.05}>
            <RandomizedLight radius={5} position={[10, 15, -5]} />
          </AccumulativeShadows>
        )}
      </group>
      <OrbitControls enablePan={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2.25} />
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

export default function Scene() {
  const [overlayPage, setOverlayPage] = useState<number | null>(null)

  return (
    <>
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [-6, 6, 10], fov: 28 }}>
        <SceneContent
          onPageDoubleClick={
            BOOK_PDF_URL ? (pageNumber) => setOverlayPage(pageNumber) : undefined
          }
        />
      </Canvas>
      {BOOK_PDF_URL && overlayPage !== null && (
        <PdfOverlay
          url={BOOK_PDF_URL}
          page={overlayPage}
          onClose={() => setOverlayPage(null)}
        />
      )}
    </>
  )
}
