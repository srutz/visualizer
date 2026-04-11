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
  // currentPage = 0 means the book is closed. currentPage = k means
  // the front cover and sheets 0..k-1 are flipped onto the left side.
  const [currentPage, setCurrentPage] = useState(0)

  const totalPagesThickness = pageCount * pageThickness
  const pagesStartY = -totalPagesThickness / 2

  const turn = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.nativeEvent.shiftKey) {
      setCurrentPage((p) => Math.max(p - 1, 0))
    } else {
      setCurrentPage((p) => Math.min(p + 1, pageCount))
    }
  }

  const coverOpen = currentPage > 0
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

      {/* Front cover — flips like a page when the book opens */}
      <Cover
        width={coverWidth}
        height={coverHeight}
        thickness={coverThickness}
        yPosition={pagesStartY + totalPagesThickness + coverThickness / 2}
        open={coverOpen}
      />

      {/* Paper sheets */}
      {Array.from({ length: pageCount }, (_, i) => (
        <Sheet
          key={i}
          index={i}
          width={width}
          height={height}
          thickness={pageThickness}
          yPosition={
            pagesStartY + (pageCount - 1 - i) * pageThickness + pageThickness / 2
          }
          flipped={i < currentPage}
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
  yPosition,
  open,
}: {
  width: number
  height: number
  thickness: number
  yPosition: number
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
    <group ref={groupRef} position={[0, yPosition, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, 0, 0]}>
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
  yPosition,
  flipped,
  drawPage,
}: {
  index: number
  width: number
  height: number
  thickness: number
  yPosition: number
  flipped: boolean
  drawPage: DrawPage
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const target = flipped ? Math.PI : 0

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target, 5, dt)
  })

  const frontPage = index * 2 + 1
  const backPage = index * 2 + 2
  const frontTexture = usePageTexture(frontPage, drawPage)
  const backTexture = usePageTexture(backPage, drawPage)

  // Lift the page art a hair off the paper mesh so it doesn't z-fight.
  const lift = thickness / 2 + 0.0005

  return (
    <group ref={groupRef} position={[0, yPosition, 0]}>
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
