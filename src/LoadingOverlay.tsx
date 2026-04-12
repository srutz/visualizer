
export function LoadingOverlay({ current, total }: { current: number; total: number }) {
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
