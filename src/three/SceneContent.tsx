import { Center, ContactShadows, OrbitControls } from "@react-three/drei"
import { Book } from "./Book"


export function SceneContent({
  pageCount,
  pageImages,
  frontCoverText,
  backCoverInnerText,
  frontCoverOuterImage,
  backCoverOuterImage,
  coverColor,
  onPageOpen,
}: {
  pageCount: number
  pageImages: (string | null | undefined)[]
  frontCoverText: string
  backCoverInnerText: string | null
  frontCoverOuterImage?: string | null
  backCoverOuterImage?: string | null
  coverColor?: string
  onPageOpen?: (pageNumber: number) => void
}) {
  const shadows = true
  const sheetCount = Math.max(1, Math.ceil(pageCount / 2))
  return (
    <>
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <group position={[0, -0.25, 0]}>
        <Center top position={[1, 0.3, 0]} >
          <Book
            // Rebuild the Book outright when the source PDF changes,
            // so sheet textures don't hold onto revoked blob URLs from
            // the previous document.
            key={`${pageCount}:${pageImages[0] ?? ''}`}
            pageCount={sheetCount}
            pageImages={pageImages}
            onPageOpen={onPageOpen}
            rotation={[0.0, 0, 0]}
            frontCoverOuterText={frontCoverText}
            backCoverInnerText={backCoverInnerText ?? undefined}
            frontCoverOuterImage={frontCoverOuterImage}
            backCoverOuterImage={backCoverOuterImage}
            coverColor={coverColor}
          />
        </Center>
        {shadows && (
          // ContactShadows is a real-time shadow that re-renders every
          // frame, so it tracks the book as it opens / closes / flips.
          // AccumulativeShadows by contrast bakes once and freezes —
          // fine for static scenes, wrong for an animating book.
          <ContactShadows
            position={[0, 0.005, 0]}
            scale={10}
            resolution={1024}
            far={3}
            blur={2.5}
            opacity={0.6}
            color="#000000"
          />
        )}
      </group>
      <OrbitControls enablePan={true} minPolarAngle={0} maxPolarAngle={Math.PI / 2.25} />
    </>
  )
}
