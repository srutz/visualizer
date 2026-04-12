// Browser-side PDF → page image loader, powered by pdfjs-dist.
//
// Takes a File the user drops on the page, rasterizes each page to a PNG
// blob URL, and hands back everything Book/BookScene needs to swap the
// default demo book for the uploaded one. Also keeps a blob URL for the
// original PDF bytes so the Ctrl/⌘-click overlay can still embed the
// vector PDF.
//
// Notes on pdfjs-dist v5:
//   - getDocument consumes the ArrayBuffer we hand it (it transfers the
//     underlying buffer to the worker), so we slice a copy for rendering
//     and keep the original for the Blob powering the overlay URL.
//   - render() in v5 takes `{ canvas, canvasContext, viewport }`. We pass
//     both canvas and context to stay forward-compatible.

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Render the page canvas this many CSS pixels wide. The book textures
// cap at 512px internally, but we render at 2× so the mipmap chain has
// something sharp to start from when the page is zoomed on-screen.
const RENDER_WIDTH = 1024

export type LoadedPdf = {
  pageImages: string[] // blob: URLs, one per page (1-indexed → pageImages[0] is page 1)
  pdfUrl: string // blob: URL for the original PDF bytes (used by the overlay iframe)
  pageCount: number // how many pages we actually rendered
  totalPages: number // how many the PDF contains, before the maxPages clamp
  truncated: boolean // true if totalPages > pageCount
  name: string // display name, usually the dropped filename without .pdf
}

export type LoadProgress = (current: number, total: number) => void

export async function loadPdfAsBook(
  file: File,
  maxPages: number,
  onProgress?: LoadProgress,
): Promise<LoadedPdf> {
  const buffer = await file.arrayBuffer()
  const name = file.name.replace(/\.pdf$/i, '') || 'document'
  return rasterizePdfBuffer(buffer, name, maxPages, onProgress)
}

// Fetch a PDF from a URL and rasterize it the same way as a dropped
// file. Supports both absolute and relative URLs. Cross-origin URLs
// only work if the remote server sends permissive CORS headers — the
// browser will otherwise reject the fetch and the caller gets a
// "Failed to fetch" error.
export async function loadPdfFromUrl(
  url: string,
  maxPages: number,
  onProgress?: LoadProgress,
  nameOverride?: string,
): Promise<LoadedPdf> {
  // Signal "fetch in progress" before the byte-level work starts, so
  // the loading overlay shows up immediately for slow networks.
  onProgress?.(0, 0)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`)
  }
  const buffer = await res.arrayBuffer()
  // Use the override if provided (e.g. when the fetch URL is a proxy),
  // otherwise derive a display name from the URL's last path segment.
  let name = nameOverride || 'document'
  if (!nameOverride) {
    try {
      const parsed = new URL(url, window.location.href)
      const last = parsed.pathname.split('/').filter(Boolean).pop()
      if (last) name = decodeURIComponent(last).replace(/\.pdf$/i, '') || 'document'
    } catch {
      // Fall through with the default name.
    }
  }
  return rasterizePdfBuffer(buffer, name, maxPages, onProgress)
}

// Shared rasterization core used by both the File and URL entry points.
async function rasterizePdfBuffer(
  buffer: ArrayBuffer,
  name: string,
  maxPages: number,
  onProgress?: LoadProgress,
): Promise<LoadedPdf> {
  // Make a copy for pdfjs to consume — it will transfer/detach the
  // buffer it's given, and we still need the original bytes for the
  // overlay's iframe src.
  const renderCopy = buffer.slice(0)
  const pdfBlob = new Blob([buffer], { type: 'application/pdf' })
  const pdfUrl = URL.createObjectURL(pdfBlob)

  let doc: pdfjsLib.PDFDocumentProxy | null = null
  const pageImages: string[] = []

  try {
    doc = await pdfjsLib.getDocument({ data: renderCopy }).promise
    const totalPages = doc.numPages
    const pageCount = Math.min(totalPages, maxPages)
    onProgress?.(0, pageCount)

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = RENDER_WIDTH / baseViewport.width
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to create 2D canvas context')

      // Most PDFs draw text on a transparent background; paint white
      // first so the resulting PNG isn't see-through on the book pages.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      page.cleanup()

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) throw new Error(`Failed to rasterize page ${i}`)
      pageImages.push(URL.createObjectURL(blob))
      onProgress?.(i, pageCount)
    }

    return {
      pageImages,
      pdfUrl,
      pageCount,
      totalPages,
      truncated: totalPages > pageCount,
      name,
    }
  } catch (err) {
    // Roll back any blob URLs we already made so we don't leak on error.
    URL.revokeObjectURL(pdfUrl)
    for (const url of pageImages) URL.revokeObjectURL(url)
    throw err
  } finally {
    if (doc) {
      try {
        await doc.destroy()
      } catch {
        // Ignore — destroy races with render errors and can throw.
      }
    }
  }
}

export function revokeLoadedPdf(loaded: LoadedPdf) {
  URL.revokeObjectURL(loaded.pdfUrl)
  for (const url of loaded.pageImages) URL.revokeObjectURL(url)
}
