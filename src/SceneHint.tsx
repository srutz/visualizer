
export function SceneHint() {
  const modKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl'
  return (
    <div className="hidden md:flex min-w-[600px] fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
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
