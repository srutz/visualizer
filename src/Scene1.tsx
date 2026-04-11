

import { AccumulativeShadows, Center, OrbitControls, RandomizedLight } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Book } from './Book'

// Point these at whatever you rendered with scripts/pdf-to-pages.sh.
// BOOK_DIR is the subfolder name you passed to the script (it lives under
// public/), and BOOK_PAGE_COUNT is the total number of pages in the PDF.
// A book has two pages per sheet, so the number of physical sheets is
// ceil(BOOK_PAGE_COUNT / 2). Any missing image falls back to a rendered
// page number, so you can safely tweak these before the files exist.
const BOOK_DIR = 'cv_stepanrutz'
const BOOK_PAGE_COUNT = 12

const pageImages = Array.from(
  { length: BOOK_PAGE_COUNT },
  (_, i) => `/${BOOK_DIR}/page-${String(i + 1).padStart(3, '0')}.png`,
)
const sheetCount = Math.ceil(BOOK_PAGE_COUNT / 2)

function SceneContent() {
  const { shadow } = { shadow: '#000000' }
  const shadows = false
  return (
    <>
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <group position={[0, -0.25, 0]}>
        <Center top position={[0, 0.3, 0]} >
          <Book pageCount={sheetCount} pageImages={pageImages} />
        </Center>
        {shadows && (
          <AccumulativeShadows temporal frames={100} color={shadow} opacity={1.05}>
            <RandomizedLight radius={5} position={[10, 5, -5]} />
          </AccumulativeShadows>
        )}
      </group>
      <OrbitControls enablePan={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2.25} />
    </>
  )
}

export default function Scene() {
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [-6, 6, 10], fov: 28 }}>
      <SceneContent />
    </Canvas>
  )
}
