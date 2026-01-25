import * as THREE from 'three';

interface GridHelperProps {
  size?: number;
  divisions?: number;
  showAxes?: boolean;
  gridCenter?: [number, number, number];
}

export function RVizGrid({ size = 25, divisions = 50, showAxes = true, gridCenter = [0, 0, 0] }: GridHelperProps) {
  return (
    <group>
      {/* Main grid */}
      <gridHelper
        args={[size, divisions, '#2563eb', '#1e3a5f']}
        position={gridCenter}
      />

      {/* Coordinate axes */}
      {showAxes && (
        <group position={[0, 0.01, 0]}>
          {/* X axis - Red */}
          <arrowHelper
            args={[
              new THREE.Vector3(1, 0, 0),
              new THREE.Vector3(0, 0, 0),
              2,
              0xef4444,
              0.3,
              0.15
            ]}
          />
          {/* Y axis (up) - Blue */}
          <arrowHelper
            args={[
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(0, 0, 0),
              2,
              0x3b82f6,
              0.3,
              0.15
            ]}
          />
          {/* Z axis - Green */}
          <arrowHelper
            args={[
              new THREE.Vector3(0, 0, 1),
              new THREE.Vector3(0, 0, 0),
              2,
              0x22c55e,
              0.3,
              0.15
            ]}
          />
        </group>
      )}
    </group>
  );
}
