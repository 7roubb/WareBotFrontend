import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface CoordinatePointerProps {
    originX: number;
    originY: number;
    mapWidth: number;
    mapHeight: number;
}

export function CoordinatePointer({ originX, originY, mapWidth, mapHeight }: CoordinatePointerProps) {
    const { camera, raycaster, pointer } = useThree();
    const [worldCoords, setWorldCoords] = useState<{ x: number; y: number; sceneX: number; sceneZ: number } | null>(null);
    const cursorRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        // Update raycaster
        raycaster.setFromCamera(pointer, camera);

        // Create a plane at y=0 representing the floor
        const planeNormal = new THREE.Vector3(0, 1, 0);
        const planePoint = new THREE.Vector3(0, 0, 0);
        const plane = new THREE.Plane(planeNormal, 0);

        const intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectionPoint);

        if (intersectionPoint && cursorRef.current) {
            const sceneX = intersectionPoint.x;
            const sceneZ = intersectionPoint.z;

            // Check if within map bounds
            const centerX = mapHeight / 2;
            const centerZ = -mapWidth / 2;

            const minX = 0;
            const maxX = mapHeight;
            const minZ = -mapWidth;
            const maxZ = 0;

            if (sceneX >= minX && sceneX <= maxX && sceneZ >= minZ && sceneZ <= maxZ) {
                // Convert scene coordinates back to world/ROS coordinates
                // Scene X -> ROS Y
                // Scene Z -> ROS X (negated)
                const worldX = -sceneZ + originX;
                const worldY = sceneX + originY;

                setWorldCoords({ x: worldX, y: worldY, sceneX, sceneZ });
                cursorRef.current.position.set(sceneX, 0.05, sceneZ);
                cursorRef.current.visible = true;
            } else {
                cursorRef.current.visible = false;
                setWorldCoords(null);
            }
        }
    });

    return (
        <>
            {/* Cursor indicator on floor */}
            <mesh ref={cursorRef} visible={false}>
                <circleGeometry args={[0.15, 32]} />
                <meshBasicMaterial color="#ffa600" transparent opacity={0.6} />
            </mesh>

            {/* Coordinate label */}
            {worldCoords && (
                <Billboard position={[worldCoords.sceneX, 0.3, worldCoords.sceneZ]} follow>
                    <Text
                        fontSize={0.2}
                        color="#ffffff"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {`X: ${worldCoords.x.toFixed(2)}, Y: ${worldCoords.y.toFixed(2)}`}
                    </Text>
                </Billboard>
            )}
        </>
    );
}
