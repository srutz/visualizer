import { FaFilePdf } from "react-icons/fa6";
import { MAX_USER_PDF_PAGES } from "./BookContainer";

export function DropOverlay() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
      <div
        className="px-10 py-8 rounded-2xl border-4 border-dashed border-white/80 text-white text-xl font-semibold flex flex-col items-center gap-3">
        <FaFilePdf className="w-10 h-10" />
        Drop your PDF to load it (max {MAX_USER_PDF_PAGES} pages)
      </div>
    </div>
  )
}