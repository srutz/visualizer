

import { AccumulativeShadows, Center, OrbitControls, RandomizedLight } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Book } from './Book'


function SceneContent() {
  const { shadow } = { shadow: '#000000' }
  return (
    <>
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <group position={[0, -0.25, 0]}>
        <Center top position={[0, 0.3, 0]} >
          <Book pageCount={12} />
        </Center>
        <AccumulativeShadows temporal frames={100} color={shadow} opacity={1.05}>
          <RandomizedLight radius={5} position={[10, 5, -5]} />
        </AccumulativeShadows>
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
