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

const PAGE_ASPECT = 1.4 // height / width
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
) => void

type BookProps = {
  pageCount: number
  width?: number
  height?: number
  pageThickness?: number
  coverThickness?: number
  drawPage?: DrawPage
}

const defaultDrawPage: DrawPage = (ctx, pageNumber, w, h) => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#2a2014'
  ctx.font = `${Math.floor(w * 0.7)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(pageNumber), w / 2, h / 2)
}

function usePageTexture(pageNumber: number, draw: DrawPage) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_PX_WIDTH
    canvas.height = Math.round(TEXTURE_PX_WIDTH * PAGE_ASPECT)
    const ctx = canvas.getContext('2d')!
    draw(ctx, pageNumber, canvas.width, canvas.height)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
    return tex
  }, [pageNumber, draw])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

export function Book({
  pageCount,
  width = 2,
  height = width * PAGE_ASPECT,
  pageThickness = 0.008,
  coverThickness = 0.05,
  drawPage = defaultDrawPage,
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

  const turn = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.nativeEvent.shiftKey) {
      setStep((p) => Math.max(p - 1, 0))
    } else {
      setStep((p) => Math.min(p + 1, maxStep))
    }
  }

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

      {/* Spine */}
      <mesh
        castShadow
        receiveShadow
        position={[-0.03, pagesStartY + totalPagesThickness / 2, 0]}
      >
        <boxGeometry
          args={[
            0.06,
            totalPagesThickness + coverThickness * 2,
            coverHeight,
          ]}
        />
        <meshStandardMaterial color="#2a1810" roughness={0.9} />
      </mesh>

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
      {Array.from({ length: pageCount }, (_, i) => (
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
        />
      ))}
    </group>
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
}: {
  index: number
  width: number
  height: number
  thickness: number
  restY: number
  flippedY: number
  flipped: boolean
  drawPage: DrawPage
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
  const frontTexture = usePageTexture(frontPage, drawPage)
  const backTexture = usePageTexture(backPage, drawPage)

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
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={frontTexture} toneMapped={false} />
      </mesh>

      {/* Back face: bottom of the sheet before flipping (becomes an even page
          once the sheet is flipped to the left side). */}
      <mesh
        position={[width / 2, -lift, 0]}
        rotation={[Math.PI / 2, 0, Math.PI]}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  )
}
