import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface OccupancyGridProps {
  data: number[];
  width: number;
  height: number;
  resolution: number;
  originX?: number;
  originY?: number;
}

export function OccupancyGrid3D({ data, width, height, resolution, originX = 0, originY = 0 }: OccupancyGridProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, texture } = useMemo(() => {
    // Create texture from occupancy data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const imageData = ctx.createImageData(width, height);
      
      for (let i = 0; i < data.length; i++) {
        const row = Math.floor(i / width);
        const col = i % width;
        // Flip Y for proper orientation
        const canvasRow = height - 1 - row;
        const offset = (canvasRow * width + col) * 4;
        
        const value = data[i];
        
        // RViz-style coloring
        if (value === 100) {
          // Obstacle - dark red/maroon
          imageData.data[offset] = 139;
          imageData.data[offset + 1] = 35;
          imageData.data[offset + 2] = 35;
          imageData.data[offset + 3] = 255;
        } else if (value === 0) {
          // Free space - dark slate
          imageData.data[offset] = 30;
          imageData.data[offset + 1] = 41;
          imageData.data[offset + 2] = 59;
          imageData.data[offset + 3] = 255;
        } else if (value === -1 || value < 0) {
          // Unknown - very dark
          imageData.data[offset] = 15;
          imageData.data[offset + 1] = 23;
          imageData.data[offset + 2] = 36;
          imageData.data[offset + 3] = 255;
        } else if (value > 0 && value < 100) {
          // Gradient
          const intensity = value / 100;
          imageData.data[offset] = Math.floor(30 + (139 - 30) * intensity);
          imageData.data[offset + 1] = Math.floor(41 + (35 - 41) * intensity);
          imageData.data[offset + 2] = Math.floor(59 + (35 - 59) * intensity);
          imageData.data[offset + 3] = 255;
        } else {
          // Default unknown
          imageData.data[offset] = 15;
          imageData.data[offset + 1] = 23;
          imageData.data[offset + 2] = 36;
          imageData.data[offset + 3] = 255;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;

    const worldWidth = width * resolution;
    const worldHeight = height * resolution;
    const geo = new THREE.PlaneGeometry(worldWidth, worldHeight);

    return { geometry: geo, texture: tex };
  }, [data, width, height, resolution]);

  const worldWidth = width * resolution;
  const worldHeight = height * resolution;

  return (
    <mesh
      ref={meshRef}
      position={[originX + worldWidth / 2, 0.01, originY + worldHeight / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1, -1, -1]}
      receiveShadow
    >
      <primitive object={geometry} />
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}
