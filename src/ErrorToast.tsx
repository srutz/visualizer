import { useEffect } from "react"

export function ErrorToast({
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