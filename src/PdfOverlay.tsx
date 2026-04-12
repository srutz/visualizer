
// Fullscreen HTML overlay that embeds the original PDF at a specific
// page using the browser's built-in viewer. Chrome (PDFium) and Firefox
// (PDF.js) both honor the `#page=N` / `#view=FitH` fragment from
// Adobe's "Open Parameters" spec, so the page is rendered as real

import { useEffect } from "react"

// vectors at display resolution — no PNG raster involved.
export function PdfOverlay({
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
