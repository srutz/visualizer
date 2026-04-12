import { useLocalStorage } from "@uidotdev/usehooks";
import { useRef, useState } from "react";
import { Button, Form, Nav, Offcanvas } from "react-bootstrap";
import { FaDownload, FaGithub, FaUpload } from "react-icons/fa6";
import { BookContainer } from "./BookContainer";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-bootstrap Button produces TS2590 with strict TS
const BsButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }> = Button

export function App() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [pdfInfo, setPdfInfo] = useState<{ url: string; filename: string } | null>(null);
  const [zen, setZen] = useLocalStorage("zenmode", false);
  const [useCovers, setUseCovers] = useLocalStorage("useCovers", false);
  const [frontText, setFrontText] = useLocalStorage("frontCoverText", "");
  const [backText, setBackText] = useLocalStorage("backCoverText", "");
  const [coverColor, setCoverColor] = useLocalStorage("coverColor", "#3a2414");
  const [maxPages, setMaxPages] = useLocalStorage("maxPages", 48);
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

      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} scroll backdrop={false} style={{ width: "280px" }} data-bs-theme="dark">
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
          <hr className="border-secondary" />
          <Form.Check
            type="switch"
            id="covers-toggle"
            label="Use first/last pages as covers"
            checked={useCovers}
            onChange={(e) => setUseCovers(e.target.checked)}
          />
          <hr className="border-secondary" />
          <Form.Group className="mb-2">
            <Form.Label className="small text-secondary mb-1">Front cover text</Form.Label>
            <Form.Control
              size="sm"
              type="text"
              placeholder="(default)"
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              data-bs-theme="dark"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small text-secondary mb-1">Back cover text</Form.Label>
            <Form.Control
              size="sm"
              type="text"
              placeholder="(default)"
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              data-bs-theme="dark"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small text-secondary mb-1">Cover color</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Form.Control
                type="color"
                value={coverColor}
                onChange={(e) => setCoverColor(e.target.value)}
                style={{ width: 40, height: 30, padding: 2, border: "1px solid #555" }}
              />
              <span className="small text-secondary">{coverColor}</span>
              {coverColor !== "#3a2414" && (
                <BsButton variant="outline-secondary" size="sm" onClick={() => setCoverColor("#3a2414")}>
                  Reset
                </BsButton>
              )}
            </div>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small text-secondary mb-1">Max pages</Form.Label>
            <Form.Control
              size="sm"
              type="number"
              min={1}
              max={200}
              value={maxPages}
              onChange={(e) => setMaxPages(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 48)))}
              data-bs-theme="dark"
            />
          </Form.Group>
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

      <BookContainer onPdfInfo={setPdfInfo} onPickFileRef={pickFileRef} zen={zen} useCovers={useCovers} frontTextOverride={frontText || undefined} backTextOverride={backText || undefined} coverColor={coverColor} maxPages={maxPages} />
    </div>
  );
}

