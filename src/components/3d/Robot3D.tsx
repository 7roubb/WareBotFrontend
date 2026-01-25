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
  children?: React.ReactNode;
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
  children,
}: Robot3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const initializedRef = useRef(false);

  // Target values ref to avoid heavy re-renders or stale closures not needed if we use props directly in useFrame?
  // Actually, props in useFrame are fine if we rely on the closure, but let's be safe.
  // Ideally, we just use the props which update on re-render.

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
    return clone;
  }, [scene]);

  // YAW CONVERSION
  // ROS: yaw = 0 -> +X (in ROS frame)
  // Three: forward = -Z
  // We need to map ROS yaw to Three Y rotation.
  const targetRotation = -yaw + Math.PI / 2;

  // Animation Loop for Smoothing and Glow
  useFrame((state, delta) => {
    // 1. Glow Animation
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.9;
      glowRef.current.scale.setScalar(pulse);
    }

    // 2. Smooth Movement & Rotation (Lerp)
    if (groupRef.current) {
      // Initialize position instantly on first frame to prevent flying in from 0,0,0
      if (!initializedRef.current) {
        groupRef.current.position.set(x, 0, y);
        groupRef.current.rotation.set(0, targetRotation, 0);
        initializedRef.current = true;
        return;
      }

      const smoothingSpeed = 5; // Adjust this for faster/slower smoothing
      const t = Math.min(1, delta * smoothingSpeed);

      // Interpolate Position
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, x, t);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, y, t);
      // Y position is constant 0

      // Interpolate Rotation (handle wrap-around if needed, but simple lerp usually ok for small changes)
      // For proper shortest-path rotation, quaternions are better, but basic lerp is likely sufficient for now.
      // If the robot spins 360, simple lerp might look weird, but let's stick to simple lerp first.

      // Shortest path angle lerp
      let currentY = groupRef.current.rotation.y;
      let targetY = targetRotation;

      // Normalize to -PI to +PI to ensure shortest path
      // (Optional optimization: if we really care about spin direction, we'd use Quaternions)
      // A simple trick:
      const diff = targetY - currentY;
      if (diff > Math.PI) currentY += 2 * Math.PI;
      else if (diff < -Math.PI) currentY -= 2 * Math.PI;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(currentY, targetRotation, t);
    }
  });

  // Status color
  const statusColor = useMemo(() => {
    switch (status) {
      case 'IDLE':
        return '#94b6ee'; // Keeping as cool blue for idle
      case 'BUSY':
        return '#ffa600'; // Primary/Yellow for active/busy
      case 'ERROR':
        return '#e02424'; // Destructive/Red
      default:
        return '#ffa600'; // Primary
    }
  }, [status]);

  return (
    // Note: Removed position={[x, 0, y]} from group because we control it manually in useFrame
    <group ref={groupRef}>
      {/* Robot model */}
      <primitive
        object={clonedScene}
        scale={[0.8, 0.8, 0.8]}
        rotation={[0, Math.PI / 2, 0]}

      // Rotation controlled by group now
      />

      {/* Status ring */}
      <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}
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

      {/* Attached Objects */}
      {children}
    </group>
  );
}

useGLTF.preload('/robot-model.glb');
 