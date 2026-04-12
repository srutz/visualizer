import { useLocalStorage } from "@uidotdev/usehooks";
import { useRef, useState } from "react";
import { Button, Form, Nav, Offcanvas } from "react-bootstrap";
import { FaDownload, FaGithub, FaUpload } from "react-icons/fa6";
import { BookScene } from "./BookScene";

// @ts-ignore — react-bootstrap Button produces TS2590 with strict TS
const BsButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }> = Button

export function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{ url: string; filename: string } | null>(null);
  const [zen, setZen] = useLocalStorage("zenmode", false);
  const pickFileRef = useRef<((file: File) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-screen h-screen bg-zinc-300 flex flex-col items-center justify-center">
      <BsButton
        variant="dark"
        size="sm"
        onClick={() => setShowSidebar(true)}
        style={{ position: "absolute", top: 10, left: 10, zIndex: 1000 }}
      >
        ☰
      </BsButton>

      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} style={{ width: "280px" }} data-bs-theme="dark">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>PDF-Visualizer</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="flex flex-col gap-1">
          <Nav className="flex-column">
            <Nav.Link
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="d-flex align-items-center gap-2"
            >
              <FaUpload /> Upload your own PDF
            </Nav.Link>
            {pdfInfo && (
              <Nav.Link href={pdfInfo.url} download={pdfInfo.filename} className="d-flex align-items-center gap-2">
                <FaDownload /> Download current PDF
              </Nav.Link>
            )}
            <Nav.Link
              href="https://github.com/srutz/visualizer"
              target="_blank"
              rel="noopener noreferrer"
              className="d-flex align-items-center gap-2"
            >
              <FaGithub /> Source Code
            </Nav.Link>
          </Nav>
          <div className="grow"></div>
          <p className="text-secondary small mb-0">
            License: MIT (it is free)
            <br />
            By {""}
            <a href="https://www.stepanrutz.com" target="_blank" rel="noopener noreferrer">
              Stepan Rutz
            </a>
          </p>
          <hr className="border-secondary" />
          <Form.Check
            type="switch"
            id="zen-toggle"
            label="Zen mode"
            checked={zen}
            onChange={(e) => setZen(e.target.checked)}
          />
        </Offcanvas.Body>
      </Offcanvas>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pickFileRef.current?.(file);
          e.target.value = "";
          setShowSidebar(false);
        }}
      />

      <BookScene onPdfInfo={setPdfInfo} onPickFileRef={pickFileRef} zen={zen} />
    </div>
  );
}

