import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'

// Coordinate system for a book lying flat on a table:
//   X = page width (spine at x=0, page extends to x=+width)
//   Y = stacking direction (pages stacked along +Y)
//   Z = page height (spine runs along Z)
// Pages rotate around the Z axis (the spine). A page at rest has
// rotation.z = 0; a flipped page has rotation.z = PI, landing on the
// -X side.

const HTML_PX_WIDTH = 320
const PAGE_ASPECT = 1.4 // height / width

type BookProps = {
  pageCount: number
  width?: number
  height?: number
  pageThickness?: number
  coverThickness?: number
  // Render prop so later we can swap in images extracted from a PDF —
  // any plain 2D React component works.
  renderPage?: (pageNumber: number) => ReactNode
}

const defaultRenderPage = (pageNumber: number) => (
  <div
    style={{
      width: HTML_PX_WIDTH,
      height: HTML_PX_WIDTH * PAGE_ASPECT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      fontSize: HTML_PX_WIDTH * 0.55,
      color: '#2a2014',
      background: '#fbfaf2',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}
  >
    {pageNumber}
  </div>
)

export function Book({
  pageCount,
  width = 2,
  height = width * PAGE_ASPECT,
  pageThickness = 0.008,
  coverThickness = 0.05,
  renderPage = defaultRenderPage,
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
          yPosition={pagesStartY + i * pageThickness + pageThickness / 2}
          flipped={i < currentPage}
          renderPage={renderPage}
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
  renderPage,
}: {
  index: number
  width: number
  height: number
  thickness: number
  yPosition: number
  flipped: boolean
  renderPage: (n: number) => ReactNode
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
  // Scale the HTML so HTML_PX_WIDTH css px maps to `width` world units.
  const htmlScale = width / HTML_PX_WIDTH

  return (
    <group ref={groupRef} position={[0, yPosition, 0]}>
      <mesh castShadow receiveShadow position={[width / 2, 0, 0]}>
        <boxGeometry args={[width, thickness, height]} />
        <meshStandardMaterial color="#fbfaf2" />
      </mesh>

      {/* Front face: top of the sheet before flipping (becomes an odd page). */}
      <group
        position={[width / 2, thickness / 2 + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={htmlScale}
      >
        <Html
          transform
          occlude
          style={{ pointerEvents: 'none' }}
        >
          {renderPage(frontPage)}
        </Html>
      </group>

      {/* Back face: bottom of the sheet before flipping (becomes an even page
          once the sheet is flipped to the left side). */}
      <group
        position={[width / 2, -thickness / 2 - 0.001, 0]}
        rotation={[Math.PI / 2, 0, Math.PI]}
        scale={htmlScale}
      >
        <Html
          transform
          occlude
          style={{ pointerEvents: 'none' }}
        >
          {renderPage(backPage)}
        </Html>
      </group>
    </group>
  )
}
