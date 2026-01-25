import { useRef, useMemo, useLayoutEffect } from 'react';
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
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Constants - Enhanced wall height for more realistic appearance
  const wallHeight = 1.0;
  const worldWidth = width * resolution;   // ROS X dimension
  const worldHeight = height * resolution; // ROS Y dimension

  // 1. WALLS: Instance mesh for obstacles
  // Coordinate Transform: ROS (x, y) -> Scene (y, -x)
  const { obstacleCount, matrices } = useMemo(() => {
    let count = 0;
    const mats: THREE.Matrix4[] = [];
    const tempMatrix = new THREE.Matrix4();
    const scaleMatrix = new THREE.Matrix4();

    for (let i = 0; i < data.length; i++) {
      // Filter obstacles
      if (data[i] === 100) {
        count++;

        // ROS Grid Coordinates
        const row = Math.floor(i / width); // Y index
        const col = i % width;             // X index

        // ROS Metric Coordinates (relative to origin)
        const rosX = (col * resolution) + (resolution / 2);
        const rosY = (row * resolution) + (resolution / 2);

        // Scene Coordinates Transform
        // ROS X -> Scene -Z
        // ROS Y -> Scene X
        const sceneX = rosY;
        const sceneZ = -rosX;

        // Matrix: Position at (sceneX, height/2, sceneZ)
        // Increased scale for completely seamless wall appearance
        tempMatrix.makeTranslation(sceneX, wallHeight / 2, sceneZ);
        scaleMatrix.makeScale(1.05, 1.0, 1.05); // Increased overlap for perfectly smooth walls
        tempMatrix.multiply(scaleMatrix);
        mats.push(tempMatrix.clone());
      }
    }
    return { obstacleCount: count, matrices: mats };
  }, [data, width, height, resolution]);

  useLayoutEffect(() => {
    if (meshRef.current) {
      matrices.forEach((mat, i) => {
        meshRef.current!.setMatrixAt(i, mat);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [matrices]);

  // 2. FLOOR TEXTURE
  // We need to generate a texture that maps to the floor plane.
  // The Floor Plane will be defined as:
  // Width: worldHeight (along Scene X)
  // Height: worldWidth (along Scene Z)
  // Texture Canvas: width=height (ROS rows), height=width (ROS cols)
  const floorTexture = useMemo(() => {
    // Create canvas transposed relative to grid
    const canvasWidth = height; // Maps to Scene X length
    const canvasHeight = width; // Maps to Scene Z length

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imageData = ctx.createImageData(canvasWidth, canvasHeight);

      for (let i = 0; i < data.length; i++) {
        const val = data[i];

        // Skip obstacles in floor texture (alpha 0)
        if (val === 100) continue;

        const row = Math.floor(i / width); // ROS Y
        const col = i % width;             // ROS X

        const cX = row;
        const cY = width - 1 - col;
        const offset = (cY * canvasWidth + cX) * 4;

        // Colors - Enhanced contrast
        if (val === 0) {
          // Free space - Lighter gray
          imageData.data[offset] = 170;
          imageData.data[offset + 1] = 177;
          imageData.data[offset + 2] = 189;
          imageData.data[offset + 3] = 255;
        } else {
          // Unknown - darker
          imageData.data[offset] = 12;
          imageData.data[offset + 1] = 12;
          imageData.data[offset + 2] = 18;
          imageData.data[offset + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, [data, width, height]);

  // Scene Origin Transform
  // Apply the same rotation/translation logic to the origin point
  const sceneOriginX = originY;
  const sceneOriginZ = -originX;

  // Floor Dimensions
  const planeWidth = worldHeight; // Along Scene X
  const planeHeight = worldWidth; // Along Scene Z (displayed as depth)

  // Plane Center (relative to scene origin)
  // X: 0 to planeWidth -> Center at planeWidth/2
  // Z: 0 to -planeHeight -> Center at -planeHeight/2
  const planeCenterX = planeWidth / 2;
  const planeCenterZ = -planeHeight / 2;

  return (
    <group position={[0, 0, 0]}>

      {/* Floor Plane */}
      {/* Positioned slightly lower to avoid Z-fighting at base of walls */}
      <mesh
        position={[planeCenterX, -0.05, planeCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial map={floorTexture} side={THREE.DoubleSide} />
      </mesh>

      {/* Walls Instanced Mesh - Enhanced realistic appearance */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, obstacleCount]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[resolution, wallHeight, resolution]} />
        <meshStandardMaterial
          color="#b8b3ad"
          roughness={0.95}
          metalness={0.02}
          envMapIntensity={0.3}
          flatShading={false}
        />
      </instancedMesh>

    </group>
  );
}
