
// Top-center overlay with prev/next page buttons. We dispatch the same
// PageUp/PageDown KeyboardEvents the Book component already listens for,
// so the buttons stay decoupled from the Book's internal step state.

import { Button } from "react-bootstrap";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-bootstrap Button produces TS2590 with strict TS
export const BsButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }> = Button

export function PageNavButtons() {
  const flip = (key: 'PageUp' | 'PageDown') => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 flex gap-2">
      <BsButton
        variant="dark"
        size="sm"
        onClick={() => flip('PageUp')}
        title="Previous page"
        aria-label="Previous page"
        className="d-flex align-items-center gap-2 px-4"
      >
        <FaArrowLeft />
      </BsButton>
      <BsButton
        variant="dark"
        size="sm"
        onClick={() => flip('PageDown')}
        title="Next page"
        aria-label="Next page"
        className="d-flex align-items-center gap-2 px-4"
      >
        <FaArrowRight />
      </BsButton>
    </div>
  )
}
