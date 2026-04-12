import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

// Coordinate system for a book lying flat on a table:
//   X = page width (spine at x=0, page extends to x=+width)
//   Y = stacking direction (pages stacked along +Y)
//   Z = page height (spine runs along Z)
// Pages rotate around the Z axis (the spine). A page at rest has
// rotation.z = 0; a flipped page has rotation.z = PI, landing on the
// -X side.

const PAGE_ASPECT = 1.414 // height / width — √2, i.e. A-series paper
const TEXTURE_PX_WIDTH = 512

// A DrawPage paints one page into a 2D canvas. Returning a callback
// (instead of a React component) keeps the page rendering inside the
// WebGL pipeline — and is exactly what pdf.js wants when we hook up
// real PDFs later: pdf.page.render({ canvasContext, viewport }).
export type DrawPage = (
  ctx: CanvasRenderingContext2D,
  pageNumber: number,
  width: number,
  height: number,
  debug?: boolean,
) => void

type BookProps = {
  pageCount: number
  width?: number
  height?: number
  pageThickness?: number
  coverThickness?: number
  drawPage?: DrawPage
  debug?: boolean
  // Optional image URLs, indexed by 1-based page number minus 1
  // (i.e. pageImages[0] is the image for page 1). Any slot left empty,
  // null, or undefined falls back to drawPage for that page.
  pageImages?: (string | null | undefined)[]
  // Optional artwork for the four "special" faces of the covers. Any
  // omitted slot leaves the bare leather showing through.
  //   frontCoverOuterImage — top of the front cover when the book is closed
  //   frontCoverInnerImage — visible under the first page once the book opens
  //   backCoverInnerImage  — visible under the last page once the book opens
  //   backCoverOuterImage  — bottom face of the back cover (seen from below)
  frontCoverOuterImage?: string | null
  frontCoverInnerImage?: string | null
  backCoverInnerImage?: string | null
  backCoverOuterImage?: string | null
  // Optional text fallbacks for the same four faces. A text is only used
  // if the matching image prop above is missing — pass an image OR a text,
  // not both. Useful for stamping a title on the leather without producing
  // any artwork.
  frontCoverOuterText?: string | null
  frontCoverInnerText?: string | null
  backCoverInnerText?: string | null
  backCoverOuterText?: string | null
  // Fires when a page face is Ctrl/⌘-clicked. The page number is
  // 1-based. Plain clicks still flip the book; the modifier splits
  // the two gestures cleanly with no timing hack.
  onPageOpen?: (pageNumber: number) => void
  // Color of the book cover leather. Defaults to a dark brown (#3a2414).
  coverColor?: string
  // Initial rotation of the whole book, in radians [x, y, z]. Useful for
  // angling the book on a table without wrapping it in another group.
  rotation?: [number, number, number]
}

// Darken a hex color by a factor (0 = black, 1 = unchanged).
function darkenColor(hex: string, factor: number): string {
  const m = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!m) return hex
  const r = Math.round(parseInt(m[1], 16) * factor)
  const g = Math.round(parseInt(m[2], 16) * factor)
  const b = Math.round(parseInt(m[3], 16) * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const defaultDrawPage: DrawPage = (ctx, pageNumber, w, h, debug) => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  if (debug) {
    ctx.fillStyle = '#2a2014'
    ctx.font = `${Math.floor(w * 0.7)}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(pageNumber), w / 2, h / 2)
  }
}

function usePageTexture(pageNumber: number, draw: DrawPage, debug?: boolean) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_PX_WIDTH
    canvas.height = Math.round(TEXTURE_PX_WIDTH * PAGE_ASPECT)
    const ctx = canvas.getContext('2d')!
    draw(ctx, pageNumber, canvas.width, canvas.height, debug)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
    return tex
  }, [pageNumber, draw, debug])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

// Renders a short string into a CanvasTexture so it can be slapped onto a
// cover face as a fallback when no image is provided. Word-wraps and shrinks
// the font to fit; uses cream-on-leather colors so it reads as a stamped
// title against the brown box behind it.
function useTextTexture(text: string | null | undefined, bgColor = '#3a2414') {
  const texture = useMemo(() => {
    if (!text) return null
    const w = TEXTURE_PX_WIDTH
    const h = Math.round(TEXTURE_PX_WIDTH * PAGE_ASPECT)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // Leather-colored background so the texture blends with the cover box
    // even at the very edges where the lift might let pixels peek through.
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)

    // Word-wrap: try a generous font size first, shrink until every line
    // fits inside the safe area. Beats clipping when the user passes a
    // longer title.
    const margin = w * 0.12
    const maxWidth = w - margin * 2
    const maxHeight = h - margin * 2
    ctx.fillStyle = '#f1e3c6'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const words = text.split(/\s+/).filter(Boolean)
    let fontSize = Math.floor(w * 0.14)
    let lines: string[] = []
    while (fontSize > 12) {
      ctx.font = `600 ${fontSize}px sans, Georgia, serif`
      lines = []
      let current = ''
      for (const word of words) {
        const trial = current ? `${current} ${word}` : word
        if (ctx.measureText(trial).width <= maxWidth) {
          current = trial
        } else {
          if (current) lines.push(current)
          current = word
        }
      }
      if (current) lines.push(current)
      const lineHeight = fontSize * 1.25
      const totalHeight = lineHeight * lines.length
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
      if (totalHeight <= maxHeight && widest <= maxWidth) break
      fontSize -= 4
    }

    const lineHeight = fontSize * 1.25
    const totalHeight = lineHeight * lines.length
    const startY = h / 2 - totalHeight / 2 + lineHeight / 2
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * lineHeight)
    })

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
    return tex
  }, [text, bgColor])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

// Loads an image URL into a Texture, or returns null if no URL is given.
// Triggers a re-render once loaded so the page can swap from the canvas
// fallback to the real image.
function useImageTexture(url: string | null | undefined) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTimeout(() => {
        setTexture(null)
      }, 0)
      return
    }
    let cancelled = false
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        loaded = tex
        setTexture(tex)
      },
      undefined,
      () => {
        // On load error, leave texture null so the canvas fallback shows.
      },
    )
    return () => {
      cancelled = true
      loaded?.dispose()
      setTexture(null)
    }
  }, [url])

  return texture
}

export function Book({
  pageCount,
  width = 2,
  height = width * PAGE_ASPECT,
  pageThickness = 0.008,
  coverThickness = 0.05,
  drawPage = defaultDrawPage,
  pageImages,
  frontCoverOuterImage,
  frontCoverInnerImage,
  backCoverInnerImage,
  backCoverOuterImage,
  frontCoverOuterText,
  frontCoverInnerText,
  backCoverInnerText,
  backCoverOuterText,
  onPageOpen,
  coverColor = '#3a2414',
  rotation = [0, 0, 0],
  debug = false,
}: BookProps) {
  // step 0                 : book closed.
  // step 1                 : cover open, NO sheets flipped (page 1 on top right).
  // step k (2..pageCount+1): cover open, sheets 0..k-2 flipped onto the left side.
  // step pageCount+2       : every sheet flipped AND the back cover swung up
  //                          to close on top of the stack — the natural
  //                          end-of-book gesture, so clicking past the last
  //                          page actually does something.
  // The cover gets its own "click stage" so the first interaction only
  // swings the cover open without dragging sheet 0 along with it.
  const [step, setStep] = useState(0)
  const maxStep = pageCount + 2

  // Auto-open the cover shortly after mount so the book doesn't greet the
  // user closed. Only runs once — user interaction afterwards is unaffected.
  useEffect(() => {
    const id = window.setTimeout(() => setStep((p) => (p === 0 ? 1 : p)), 500)
    return () => window.clearTimeout(id)
  }, [])

  // Keyboard navigation: arrows and PageUp/PageDown drive the same step
  // forward/back as clicks. Bound on window so the user doesn't have to
  // focus the canvas first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        setStep((p) => Math.min(p + 1, maxStep))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setStep((p) => Math.max(p - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maxStep])

  const totalPagesThickness = pageCount * pageThickness
  const pagesStartY = -totalPagesThickness / 2

  const turn = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // Ctrl/⌘-click is reserved for opening the page overlay — handled by
    // the Sheet face meshes below. Here we only care about plain/shift clicks.
    if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) return
    if (e.nativeEvent.shiftKey) {
      setStep((p) => Math.max(p - 1, 0))
    } else {
      setStep((p) => Math.min(p + 1, maxStep))
    }
  }

  const coverOpen = step > 0
  const flippedSheets = Math.min(pageCount, Math.max(0, step - 1))
  const backCoverClosed = step >= pageCount + 2
  const coverWidth = width + 0.06
  const coverHeight = height + 0.06

  return (
    <group rotation={rotation} onClick={turn}>
      {/* Back cover — hinges at the spine like the front cover does. While
          the book is open it sits below the page stack (rotation 0); on the
          final click it swings 180° to close on top of the flipped pages. */}
      <BackCover
        width={coverWidth}
        height={coverHeight}
        thickness={coverThickness}
        hingeY={pagesStartY + totalPagesThickness / 2}
        meshYOffset={-(totalPagesThickness / 2 + coverThickness / 2)}
        closed={backCoverClosed}
        outerImageUrl={backCoverOuterImage}
        innerImageUrl={backCoverInnerImage}
        outerText={backCoverOuterText}
        innerText={backCoverInnerText}
        coverColor={coverColor}
      />

      {/* Spine — shrinks and drops to table level when the book opens. */}
      <Spine
        depth={coverHeight}
        closedHeight={totalPagesThickness + coverThickness * 2}
        openHeight={coverThickness}
        closedCenterY={pagesStartY + totalPagesThickness / 2}
        openCenterY={pagesStartY - coverThickness / 2}
        open={coverOpen}
        flipped={backCoverClosed}
        color={darkenColor(coverColor, 0.7)}
      />

      {/* Front cover — flips like a page when the book opens.
          We hinge it around the MIDDLE of the page stack instead of the top
          so that a 180° rotation lands it at table level on the left side
          (mirroring the back cover), with all the flipped sheets sitting on
          top of it like a real open book. */}
      <Cover
        width={coverWidth}
        height={coverHeight}
        thickness={coverThickness}
        hingeY={pagesStartY + totalPagesThickness / 2}
        meshYOffset={totalPagesThickness / 2 + coverThickness / 2}
        open={coverOpen}
        outerImageUrl={frontCoverOuterImage}
        innerImageUrl={frontCoverInnerImage}
        outerText={frontCoverOuterText}
        innerText={frontCoverInnerText}
        coverColor={coverColor}
      />

      {/* Paper sheets.
          restY: position when unflipped — sheet 0 sits on TOP of the right
                 stack so the first click flips the topmost page first.
          flippedY: position when fully flipped — order is REVERSED so the
                    most recently flipped sheet ends up on top of the left
                    stack, like a real book. Sheet i animates between the
                    two as it rotates. */}
      {Array.from({ length: pageCount }, (_, i) => {
        const frontPage = i * 2 + 1
        const backPage = i * 2 + 2
        return (
          <Sheet
            key={i}
            index={i}
            width={width}
            height={height}
            thickness={pageThickness}
            restY={
              pagesStartY + (pageCount - 1 - i) * pageThickness + pageThickness / 2
            }
            flippedY={pagesStartY + i * pageThickness + pageThickness / 2}
            flipped={i < flippedSheets}
            drawPage={drawPage}
            frontImageUrl={pageImages?.[frontPage - 1] ?? null}
            backImageUrl={pageImages?.[backPage - 1] ?? null}
            debug={debug}
            onFaceOpen={onPageOpen}
          />
        )
      })}
    </group>
  )
}

function Spine({
  depth,
  closedHeight,
  openHeight,
  closedCenterY,
  openCenterY,
  open,
  flipped,
  color = '#2a1810',
}: {
  depth: number
  closedHeight: number
  openHeight: number
  closedCenterY: number
  openCenterY: number
  open: boolean
  flipped: boolean
  color?: string
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const openScale = openHeight / closedHeight

  useFrame((_, dt) => {
    const m = meshRef.current
    if (!m) return
    const closed = !open || flipped
    const targetScale = closed ? 1 : openScale
    const targetY = closed ? closedCenterY : openCenterY
    const targetOpacity = closed ? 1 : 0
    const targetX = flipped ? 0.03 : -0.03
    m.scale.y = THREE.MathUtils.damp(m.scale.y, targetScale, 4, dt)
    m.position.y = THREE.MathUtils.damp(m.position.y, targetY, 4, dt)
    m.position.x = THREE.MathUtils.damp(m.position.x, targetX, 4, dt)
    const mat = m.material as THREE.MeshStandardMaterial
    mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 4, dt)
    m.visible = mat.opacity > 0.01
  })

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      position={[-0.03, closedCenterY, 0]}
    >
      <boxGeometry args={[0.06, closedHeight, depth]} />
      <meshStandardMaterial color={color} roughness={0.9} transparent />
    </mesh>
  )
}

function Cover({
  width,
  height,
  thickness,
  hingeY,
  meshYOffset,
  open,
  outerImageUrl,
  innerImageUrl,
  outerText,
  innerText,
  coverColor = '#3a2414',
}: {
  width: number
  height: number
  thickness: number
  hingeY: number
  meshYOffset: number
  open: boolean
  outerImageUrl?: string | null
  innerImageUrl?: string | null
  outerText?: string | null
  innerText?: string | null
  coverColor?: string
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const target = open ? Math.PI : 0

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target, 4, dt)
  })

  // Image trumps text — only build the text canvas when the image slot
  // is empty, so a face never draws both at once.
  const outerImageTex = useImageTexture(outerImageUrl)
  const innerImageTex = useImageTexture(innerImageUrl)
  const outerTextTex = useTextTexture(outerImageUrl ? null : outerText, coverColor)
  const innerTextTex = useTextTexture(innerImageUrl ? null : innerText, coverColor)
  const outerTex = outerImageTex ?? outerTextTex
  const innerTex = innerImageTex ?? innerTextTex

  // Same z-fight-avoidance lift the page sheets use.
  const lift = thickness / 2 + 0.0005

  return (
    <group ref={groupRef} position={[0, hingeY, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, meshYOffset, 0]}>
        <boxGeometry args={[width, thickness, height]} />
        <meshStandardMaterial color={coverColor} roughness={0.8} />
      </mesh>

      {/* Outer face — top of the front cover when the book is closed. After
          the cover swings open it ends up on the underside, hidden against
          the table, which is exactly what a real book does. */}
      {outerTex && (
        <mesh
          position={[width / 2, meshYOffset + lift, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={outerTex} toneMapped={false} />
        </mesh>
      )}

      {/* Inner face — pressed against the first page when closed; comes
          into view (right-side up) once the cover has flipped 180°. The
          extra Z rotation pre-flips the texture so it reads correctly
          after the parent group's rotation. */}
      {innerTex && (
        <mesh
          position={[width / 2, meshYOffset - lift, 0]}
          rotation={[Math.PI / 2, 0, Math.PI]}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={innerTex} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function BackCover({
  width,
  height,
  thickness,
  hingeY,
  meshYOffset,
  closed,
  outerImageUrl,
  innerImageUrl,
  outerText,
  innerText,
  coverColor = '#3a2414',
}: {
  width: number
  height: number
  thickness: number
  hingeY: number
  // Negative — the back cover sits below the hinge while the book is open,
  // mirroring the front cover which hangs above it.
  meshYOffset: number
  closed: boolean
  outerImageUrl?: string | null
  innerImageUrl?: string | null
  outerText?: string | null
  innerText?: string | null
  coverColor?: string
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const target = closed ? Math.PI : 0

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target, 4, dt)
  })

  // Image trumps text — only build the text canvas when the image slot
  // is empty, so a face never draws both at once.
  const outerImageTex = useImageTexture(outerImageUrl)
  const innerImageTex = useImageTexture(innerImageUrl)
  const outerTextTex = useTextTexture(outerImageUrl ? null : outerText, coverColor)
  const innerTextTex = useTextTexture(innerImageUrl ? null : innerText, coverColor)
  const outerTex = outerImageTex ?? outerTextTex
  const innerTex = innerImageTex ?? innerTextTex

  // Same z-fight-avoidance lift the page sheets and front cover use.
  const lift = thickness / 2 + 0.0005

  return (
    <group ref={groupRef} position={[0, hingeY, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, meshYOffset, 0]}>
        <boxGeometry args={[width, thickness, height]} />
        <meshStandardMaterial color={coverColor} roughness={0.8} />
      </mesh>

      {/* Inner face — visible from above while the book is open; once the
          back cover swings up to close, this face presses down onto the
          topmost flipped page (the symmetric counterpart of the front
          cover's inner face). */}
      {innerTex && (
        <mesh
          position={[width / 2, meshYOffset + lift, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={innerTex} toneMapped={false} />
        </mesh>
      )}

      {/* Outer face — bottom of the back cover while reading; rotates up to
          become the visible top of the closed book at the end. */}
      {outerTex && (
        <mesh
          position={[width / 2, meshYOffset - lift, 0]}
          rotation={[Math.PI / 2, 0, Math.PI]}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={outerTex} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Sheet({
  index,
  width,
  height,
  thickness,
  restY,
  flippedY,
  flipped,
  debug,
  drawPage,
  frontImageUrl,
  backImageUrl,
  onFaceOpen,
}: {
  index: number
  width: number
  height: number
  thickness: number
  restY: number
  flippedY: number
  flipped: boolean
  debug: boolean,
  drawPage: DrawPage
  frontImageUrl: string | null | undefined
  backImageUrl: string | null | undefined
  onFaceOpen?: (pageNumber: number) => void
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const target = flipped ? Math.PI : 0

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target, 5, dt)
    // Drive Y from the rotation progress so position and angle stay in
    // lockstep — no second damper needed, no risk of them diverging.
    const t = g.rotation.z / Math.PI
    g.position.y = THREE.MathUtils.lerp(restY, flippedY, t)
  })

  const frontPage = index * 2 + 1
  const backPage = index * 2 + 2
  const frontFallback = usePageTexture(frontPage, drawPage, debug)
  const backFallback = usePageTexture(backPage, drawPage, debug)
  const frontImage = useImageTexture(frontImageUrl)
  const backImage = useImageTexture(backImageUrl)
  const frontTexture = frontImage ?? frontFallback
  const backTexture = backImage ?? backFallback
  //console.log('render sheet', index, { frontImageUrl, backImageUrl, frontTexture, backTexture })

  // Lift the page art a hair off the paper mesh so it doesn't z-fight.
  const lift = thickness / 2 + 0.0005

  return (
    <group ref={groupRef} position={[0, restY, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, 0, 0]}>
        <boxGeometry args={[width, thickness, height]} />
        <meshStandardMaterial color="#fbfaf2" />
      </mesh>

      {/* Front face: top of the sheet before flipping (becomes an odd page). */}
      <mesh
        position={[width / 2, lift, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={
          onFaceOpen
            ? (e) => {
              if (!e.nativeEvent.ctrlKey && !e.nativeEvent.metaKey) return
              e.stopPropagation()
              onFaceOpen(frontPage)
            }
            : undefined
        }
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={frontTexture} toneMapped={false} />
      </mesh>

      {/* Back face: bottom of the sheet before flipping (becomes an even page
          once the sheet is flipped to the left side). */}
      <mesh
        position={[width / 2, -lift, 0]}
        rotation={[Math.PI / 2, 0, Math.PI]}
        onClick={
          onFaceOpen
            ? (e) => {
              if (!e.nativeEvent.ctrlKey && !e.nativeEvent.metaKey) return
              e.stopPropagation()
              onFaceOpen(backPage)
            }
            : undefined
        }
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  )
}
