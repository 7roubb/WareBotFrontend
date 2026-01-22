import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface Robot3DProps {
  id: string;
  name?: string;
  x: number;
  y: number;
  yaw?: number; // degrees from ROS
  status: string;
  batteryLevel?: number;
  showLabel?: boolean;
}

export function Robot3D({
  id,
  name,
  x,
  y,
  yaw = 0,
  status,
  batteryLevel,
  showLabel = true,
}: Robot3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const { scene } = useGLTF('/robot-model.glb');

  // Clone model + improve materials
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.envMapIntensity = 1.5;
          mat.metalness = Math.min(mat.metalness ?? 0.5, 0.6);
          mat.roughness = Math.min(mat.roughness ?? 0.5, 0.6);
        }
      }
    });

    // ⚠️ إذا الموديل facing غلط عدّل هذا السطر فقط
    // clone.rotation.y = Math.PI / 2;

    return clone;
  }, [scene]);

  // Glow animation
  useFrame((state) => {
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.9;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  // Status color
  const statusColor = useMemo(() => {
    switch (status) {
      case 'IDLE':
        return '#94b6ee';
      case 'BUSY':
        return '#22c55e';
      case 'ERROR':
        return '#ef4444';
      default:
        return '#3b82f6';
    }
  }, [status]);

  /**
   * YAW CONVERSION
   * ROS:
   *  - yaw = 0 → +X
   *  - CCW positive
   *
   * Three.js:
   *  - forward = -Z
   *  - rotation around Y
   */
  const yawRad = yaw ;
  const modelRotation = -yawRad + Math.PI / 2;

  return (
    <group ref={groupRef} position={[x, 0, y]}>
      {/* Robot model */}
      <primitive
        object={clonedScene}
        scale={[0.8, 0.8, 0.8]}
        rotation={[0, modelRotation, 0]}
      />

      {/* Status ring */}
      <mesh position={[0, 0.5, 0]}   rotation={[0, modelRotation, 0]}
>
        <torusGeometry args={[0.25, 0.02, 8, 32]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Glow */}
      <mesh
        ref={glowRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial
          color={statusColor}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Label */}
      {showLabel && (
        <Billboard position={[0, 1.2, 0]} follow>
          <Text
            fontSize={0.15}
            color="#ffffff"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {name || id}
          </Text>

          <Text
            position={[0, -0.18, 0]}
            fontSize={0.1}
            color={statusColor}
          >
            {status}
            {batteryLevel !== undefined ? ` • ${batteryLevel}%` : ''}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

useGLTF.preload('/robot-model.glb');
