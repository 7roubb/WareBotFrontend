import { useMemo } from 'react';
import * as THREE from 'three';

interface TaskLine3DProps {
  pickupX: number;
  pickupY: number;
  dropX: number;
  dropY: number;
  status: string;
}

export function TaskLine3D({ pickupX, pickupY, dropX, dropY, status }: TaskLine3DProps) {
  const { points, color } = useMemo(() => {
    const lineColor = status === 'IN_PROGRESS' ? '#ffa600' : // Primary/Yellow
      status === 'PENDING' ? '#f5a50f' : // Warning/Orange
        '#1bca56'; // Success/Green

    // Create curved path
    const pts: THREE.Vector3[] = [];
    const segments = 32;
    const arcHeight = 0.5;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = pickupX + (dropX - pickupX) * t;
      const z = pickupY + (dropY - pickupY) * t;
      // Parabolic arc
      const y = arcHeight * 4 * t * (1 - t) + 0.1;
      pts.push(new THREE.Vector3(x, y, z));
    }

    return { points: pts, color: lineColor };
  }, [pickupX, pickupY, dropX, dropY, status]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  return (
    <group>
      {/* Task line */}
      <line>
        <bufferGeometry attach="geometry" {...lineGeometry} />
        <lineDashedMaterial
          color={color}
          dashSize={0.2}
          gapSize={0.1}
          linewidth={2}
        />
      </line>

      {/* Pickup marker */}
      <mesh position={[pickupX, 0.15, pickupY]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#1bca56" emissive="#1bca56" emissiveIntensity={0.5} />
      </mesh>

      {/* Drop marker */}
      <mesh position={[dropX, 0.15, dropY]}>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshStandardMaterial color="#e02424" emissive="#e02424" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
