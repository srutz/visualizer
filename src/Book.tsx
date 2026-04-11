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
  // Fires when a page face is double-clicked. The page number is
  // 1-based. Single clicks still flip the book, but they are delayed
  // briefly so a double-click cancels the flip and dispatches this
  // callback instead.
  onPageDoubleClick?: (pageNumber: number) => void

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

function usePageTexture(pageNumber: number, draw: DrawPage, debug) {
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
  }, [pageNumber, draw])
  useEffect(() => () => texture.dispose(), [texture])
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
  onPageDoubleClick,
  debug = false,
}: BookProps) {
  // step 0          : book closed.
  // step 1          : cover open, NO sheets flipped (page 1 on top right).
  // step k (k >= 2) : cover open, sheets 0..k-2 flipped onto the left side.
  // The cover gets its own "click stage" so the first interaction only
  // swings the cover open without dragging sheet 0 along with it.
  const [step, setStep] = useState(0)
  const maxStep = pageCount + 1

  const totalPagesThickness = pageCount * pageThickness
  const pagesStartY = -totalPagesThickness / 2

  // Hold single-click page-flips just long enough that a double-click
  // on a page face can cancel them — otherwise a dbl-click would flip
  // the book twice AND open the overlay. The 220ms window is enough
  // to catch a typical dblclick (which fires right after click #2)
  // without making single clicks feel sluggish.
  const pendingTurnRef = useRef<number | null>(null)

  const turn = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const shift = e.nativeEvent.shiftKey
    if (pendingTurnRef.current != null) {
      window.clearTimeout(pendingTurnRef.current)
    }
    pendingTurnRef.current = window.setTimeout(() => {
      pendingTurnRef.current = null
      if (shift) {
        setStep((p) => Math.max(p - 1, 0))
      } else {
        setStep((p) => Math.min(p + 1, maxStep))
      }
    }, 220)
  }

  const handleFaceDoubleClick = (pageNumber: number) => {
    if (pendingTurnRef.current != null) {
      window.clearTimeout(pendingTurnRef.current)
      pendingTurnRef.current = null
    }
    onPageDoubleClick?.(pageNumber)
  }

  useEffect(() => {
    return () => {
      if (pendingTurnRef.current != null) {
        window.clearTimeout(pendingTurnRef.current)
      }
    }
  }, [])

  const coverOpen = step > 0
  const flippedSheets = Math.max(0, step - 1)
  const coverWidth = width + 0.06
  const coverHeight = height + 0.06

  return (
    <group onClick={turn}>
      {/* Back cover: sits below all pages, never animates */}
      <mesh
        castShadow
        receiveShadow
        position={[width / 2, pagesStartY - coverThickness / 2, 0]}
      >
        <boxGeometry args={[coverWidth, coverThickness, coverHeight]} />
        <meshStandardMaterial color="#3a2414" roughness={0.8} />
      </mesh>

      {/* Spine — shrinks and drops to table level when the book opens. */}
      <Spine
        depth={coverHeight}
        closedHeight={totalPagesThickness + coverThickness * 2}
        openHeight={coverThickness}
        closedCenterY={pagesStartY + totalPagesThickness / 2}
        openCenterY={pagesStartY - coverThickness / 2}
        open={coverOpen}
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
            onFaceDoubleClick={
              onPageDoubleClick ? handleFaceDoubleClick : undefined
            }
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
}: {
  depth: number
  closedHeight: number
  openHeight: number
  closedCenterY: number
  openCenterY: number
  open: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const openScale = openHeight / closedHeight

  useFrame((_, dt) => {
    const m = meshRef.current
    if (!m) return
    // Scale Y morphs the box height; position Y keeps the bottom edge
    // anchored as it shrinks. Both dampen at the cover's rate so they
    // stay visually in lockstep with the swinging cover.
    const targetScale = open ? openScale : 1
    const targetY = open ? openCenterY : closedCenterY
    m.scale.y = THREE.MathUtils.damp(m.scale.y, targetScale, 4, dt)
    m.position.y = THREE.MathUtils.damp(m.position.y, targetY, 4, dt)
  })

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      position={[-0.03, closedCenterY, 0]}
    >
      <boxGeometry args={[0.06, closedHeight, depth]} />
      <meshStandardMaterial color="#2a1810" roughness={0.9} />
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
}: {
  width: number
  height: number
  thickness: number
  hingeY: number
  meshYOffset: number
  open: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const target = open ? Math.PI : 0

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target, 4, dt)
  })

  return (
    <group ref={groupRef} position={[0, hingeY, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, meshYOffset, 0]}>
        <boxGeometry args={[width, thickness, height]} />
        <meshStandardMaterial color="#3a2414" roughness={0.8} />
      </mesh>
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
  drawPage,
  frontImageUrl,
  backImageUrl,
  onFaceDoubleClick,
}: {
  index: number
  width: number
  height: number
  thickness: number
  restY: number
  flippedY: number
  flipped: boolean
  drawPage: DrawPage
  frontImageUrl: string | null | undefined
  backImageUrl: string | null | undefined
  onFaceDoubleClick?: (pageNumber: number) => void
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
  const frontFallback = usePageTexture(frontPage, drawPage, false)
  const backFallback = usePageTexture(backPage, drawPage, false)
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
        onDoubleClick={
          onFaceDoubleClick
            ? (e) => {
              e.stopPropagation()
              onFaceDoubleClick(frontPage)
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
        onDoubleClick={
          onFaceDoubleClick
            ? (e) => {
              e.stopPropagation()
              onFaceDoubleClick(backPage)
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
