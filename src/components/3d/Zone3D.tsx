import { useRef, useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface Zone3DProps {
  id: string;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type?: 'CHARGING' | 'PICKUP' | 'DROP' | 'STORAGE' | 'RESTRICTED';
  showLabel?: boolean;
}

export function Zone3D({
  id,
  name,
  x,
  y,
  width = 3,
  height = 3,
  type = 'STORAGE',
  showLabel = true,
}: Zone3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Zone color
  const zoneColor = useMemo(() => {
    switch (type) {
      case 'CHARGING': return '#f5a50f'; // Warning/Orange
      case 'PICKUP': return '#1bca56'; // Success/Green
      case 'DROP': return '#e02424'; // Destructive/Red
      case 'STORAGE': return '#8b5cf6'; // Keep purple for storage
      case 'RESTRICTED': return '#e02424'; // Destructive/Red
      default: return '#6b7280';
    }
  }, [type]);

  return (
    <group
      ref={groupRef}
      position={[x, 0, y]}   // ✅ SAME POSITIONING AS ROBOT
    >
      {/* Zone floor (centered) */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={zoneColor}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Zone border */}
      <lineSegments position={[0, 0.03, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
        <lineBasicMaterial color={zoneColor} />
      </lineSegments>

      {/* Corner posts */}
      {[-1, 1].flatMap((xMult) =>
        [-1, 1].map((zMult, i) => (
          <mesh
            key={`${xMult}-${zMult}-${i}`}
            position={[
              xMult * (width / 2 - 0.05),
              0.2,
              zMult * (height / 2 - 0.05),
            ]}
          >
            <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
            <meshStandardMaterial
              color={zoneColor}
              emissive={zoneColor}
              emissiveIntensity={0.3}
            />
          </mesh>
        ))
      )}

      {/* Label */}
      {showLabel && (
        <Billboard position={[0, 0.8, 0]} follow>
          <Text
            fontSize={0.2}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {name || type}
          </Text>
          <Text
            position={[0, -0.25, 0]}
            fontSize={0.12}
            color={zoneColor}
            anchorX="center"
            anchorY="middle"
          >
            {type}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
