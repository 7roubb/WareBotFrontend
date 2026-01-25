import { useRef } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface Shelf3DProps {
  id: string;
  name?: string;
  x: number;
  y: number;
  yaw?: number;
  level?: number;
  available: boolean;
  width?: number;
  height?: number;
  depth?: number;
  showLabel?: boolean;
}

export function Shelf3D({
  id,
  name,
  x,
  y,
  yaw = 0,
  level = 4,
  available,
  width = 1,
  height = 1.5,
  depth = 1,
  showLabel = true,
}: Shelf3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const yawRad = (yaw * Math.PI) / 180;

  const shelfColor = available ? '#22c55e' : '#ef4444';
  const frameColor = '#4b5563';

  const shelfLevels = Math.min(level, 4);

  // ===== DIMENSIONS =====
  const wheelRadius = 0.08;          // 8 cm
  const wheelWidth = 0.04;
  const legThickness = 0.06;

  const firstShelfHeight = 0.6;      // ✅ أول رف
  const usableHeight = height - firstShelfHeight;
  const shelfSpacing =
    shelfLevels > 1 ? usableHeight / (shelfLevels - 1) : 0;

  // ارتفاع العمود الحديدي
  const legHeight = height - wheelRadius;

  return (
    <group ref={groupRef} position={[x, 0, y]} rotation={[0, -yawRad, 0]}>

      {/* ================= WHEELS ================= */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([xMult, zMult], i) => (
        <mesh
          key={`wheel-${i}`}
          position={[
            xMult * (width / 2 - 0.1),
            wheelRadius,
            zMult * (depth / 2 - 0.1),
          ]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 16]} />
          <meshStandardMaterial
            color="#111827"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* ================= FULL METAL LEGS ================= */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([xMult, zMult], i) => (
        <mesh
          key={`leg-${i}`}
          position={[
            xMult * (width / 2 - 0.05),
            wheelRadius + legHeight / 2,   // ✅ من فوق العجلات
            zMult * (depth / 2 - 0.05),
          ]}
          castShadow
        >
          <boxGeometry args={[legThickness, legHeight, legThickness]} />
          <meshStandardMaterial
            color={frameColor}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* ================= SHELVES ================= */}
      {Array.from({ length: shelfLevels }).map((_, i) => (
        <mesh
          key={`shelf-${i}`}
          position={[
            0,
            firstShelfHeight + i * shelfSpacing,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width - 0.1, 0.04, depth - 0.1]} />
          <meshStandardMaterial
            color={shelfColor}
            metalness={0.3}
            roughness={0.6}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}

      {/* ================= TOP FRAME ================= */}
      <mesh position={[0, height, 0]} castShadow>
        <boxGeometry args={[width, 0.05, depth]} />
        <meshStandardMaterial
          color={frameColor}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* ================= STATUS LIGHT ================= */}
      <mesh position={[0, height + 0.12, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={shelfColor}
          emissive={shelfColor}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* ================= LABEL ================= */}
      {showLabel && (
        <Billboard position={[0, height + 0.4, 0]} follow>
          <Text
            fontSize={0.12}
            color="#ffffff"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {name || name}
          </Text>
          <Text
            position={[0, -0.15, 0]}
            fontSize={0.08}
            color={shelfColor}
          >
            {available ? 'Available' : 'Occupied'}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
