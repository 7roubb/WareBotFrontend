import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { Robot3D } from './Robot3D';

export default function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [6, 6, 6], fov: 50 }}
    >
      {/* ===== LIGHTING ===== */}

      {/* Soft global light */}
      <ambientLight intensity={0.6} />

      {/* Main light (sun) */}
      <directionalLight
        position={[10, 12, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Fill light */}
      <directionalLight
        position={[-6, 6, -6]}
        intensity={0.4}
      />

      {/* Environment reflections */}
      <Environment preset="warehouse" />

      {/* ===== FLOOR ===== */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* ===== ROBOT ===== */}
      <Robot3D
        id="R1"
        name="Robot-01"
        x={0}
        y={0}
        yaw={45}
        status="IDLE"
        batteryLevel={87}
      />

      <OrbitControls />
    </Canvas>
  );
}
