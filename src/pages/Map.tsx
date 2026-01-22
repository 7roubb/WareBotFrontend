import { Suspense, useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stats } from '@react-three/drei';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  EyeOff,
  Layers,
  Navigation,
  Box,
  MapPin,
  Activity,
  Battery,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { maps, robots, shelves, tasks, zones } from '@/services/api';
import { subscribeToMapUpdates, onRobotUpdate, onShelfUpdate, onTelemetry } from '@/services/websocket';
import type { MapData, Robot, Shelf, Task, Zone } from '@/types';

// Import your 3D components
import { OccupancyGrid3D } from '../components/3d/OccupancyGrid3D';
import { Robot3D } from '../components/3d/Robot3D'; // Use MP 400 version
import { Shelf3D } from '../components/3d/Shelf3D';
import { Zone3D } from '../components/3d/Zone3D';
import { TaskLine3D } from '../components/3d/TaskLine3D';
import { RVizGrid } from '../components/3d/RVizGrid';

interface MapOriginObject {
  x: number;
  y: number;
  yaw?: number;
}

type MapOrigin = MapOriginObject | [number, number, number?];

interface ExtendedMapData {
  id?: string;
  name?: string;
  width: number;
  height: number;
  resolution?: number;
  origin?: MapOrigin;
  occupancy_grid?: number[][];
  robots: Robot[];
  shelves: Shelf[];
  tasks: Task[];
  zones?: Zone[];
  data?: number[];
  updated_at?: string;
  timestamp?: string;
  entity_count?: {
    robots: number;
    shelves: number;
    tasks: number;
    zones: number;
  };
  [key: string]: any;
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-accent-400">Loading 3D Scene...</p>
      </div>
    </div>
  );
}

// ============================================================================
// COORDINATE TRANSFORMATION
// ============================================================================

function worldToScene(
  worldX: number,
  worldY: number,
  originX: number,
  originY: number,
): { sceneX: number; sceneZ: number } {
  const relX = worldX - originX;
  const relY = worldY - originY;
  return {
    sceneX: relY,
    sceneZ: -relX,
  };
}

function worldYawToScene(worldYaw: number): number {
  return worldYaw + Math.PI / 2;
}

// ============================================================================
// OCCUPANCY GRID 3D
// ============================================================================

interface OccupancyGrid3DProps {
  data: number[];
  width: number;
  height: number;
  resolution: number;
  originX: number;
  originY: number;
}

function OccupancyGridCustom({
  data,
  width,
  height,
  resolution,
  originX,
  originY,
}: OccupancyGrid3DProps) {
  const { sceneX, sceneZ } = worldToScene(
    originX + (width * resolution) / 2,
    originY + (height * resolution) / 2,
    originX,
    originY,
  );

  // Use your existing OccupancyGrid3D or create inline
  return (
    <OccupancyGrid3D
      data={data}
      width={width}
      height={height}
      resolution={resolution}
      originX={originX}
      originY={originY}
    />
  );
}

// ============================================================================
// ZONE 3D
// ============================================================================

function Zone3DCustom({
  id,
  name,
  worldX,
  worldY,
  width = 1,
  height = 1,
  type = 'default',
  originX,
  originY,
  showLabel,
}: {
  id: string;
  name?: string;
  worldX: number;
  worldY: number;
  width?: number;
  height?: number;
  type?: string;
  originX: number;
  originY: number;
  showLabel: boolean;
}) {
  const { sceneX, sceneZ } = worldToScene(worldX, worldY, originX, originY);

  const zoneColor = {
    dropoff: '#ef4444',
    pickup: '#22c55e',
    charging: '#f97316',
    default: '#8b5cf6',
  }[type] || '#8b5cf6';

  return (
    <group position={[sceneX, 0.05, sceneZ]}>
      <mesh>
        <boxGeometry args={[height, 0.05, width]} />
        <meshStandardMaterial
          color={zoneColor}
          transparent
          opacity={0.5}
          emissive={zoneColor}
          emissiveIntensity={0.2}
        />
      </mesh>
    </group>
  );
}

// ============================================================================
// TASK LINE 3D
// ============================================================================

function TaskLine3DCustom({
  pickupX,
  pickupY,
  dropX,
  dropY,
  status,
  originX,
  originY,
}: {
  pickupX: number;
  pickupY: number;
  dropX: number;
  dropY: number;
  status: string;
  originX: number;
  originY: number;
}) {
  const { sceneX: startX, sceneZ: startZ } = worldToScene(pickupX, pickupY, originX, originY);
  const { sceneX: endX, sceneZ: endZ } = worldToScene(dropX, dropY, originX, originY);

  const statusColor = {
    PENDING: '#fbbf24',
    ACTIVE: '#60a5fa',
    COMPLETED: '#22c55e',
    CANCELLED: '#ef4444',
    ERROR: '#ef4444',
  }[status] || '#fbbf24';

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([startX, 0.5, startZ, endX, 0.5, endZ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={statusColor} linewidth={2} fog={false} />
      </lineSegments>
    </group>
  );
}

// ============================================================================
// SCENE 3D
// ============================================================================

interface Scene3DProps {
  mapData: ExtendedMapData | null;
  showGrid: boolean;
  showOccupancy: boolean;
  showRobots: boolean;
  showShelves: boolean;
  showZones: boolean;
  showTasks: boolean;
  showLabels: boolean;
}

function Scene3D({
  mapData,
  showGrid,
  showOccupancy,
  showRobots,
  showShelves,
  showZones,
  showTasks,
  showLabels,
}: Scene3DProps) {
  if (!mapData) return null;

  const resolution = mapData.resolution || 0.05;
  const mapWidth = (mapData.width || 100) * resolution;
  const mapHeight = (mapData.height || 80) * resolution;

  let originX = 0;
  let originY = 0;

  if (mapData.origin) {
    if (Array.isArray(mapData.origin)) {
      originX = Number(mapData.origin[0] ?? 0);
      originY = Number(mapData.origin[1] ?? 0);
    } else {
      originX = Number((mapData.origin as MapOriginObject).x ?? 0);
      originY = Number((mapData.origin as MapOriginObject).y ?? 0);
    }
  }

  const centerSceneX = mapHeight / 2;
  const centerSceneZ = -mapWidth / 2;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[centerSceneX + 10, 25, centerSceneZ + 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={150}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <pointLight position={[centerSceneX, 15, centerSceneZ]} intensity={0.5} color="#3b82f6" />

      {/* Grid */}
      {showGrid && <RVizGrid size={Math.max(mapWidth, mapHeight) * 1.2} divisions={20} />}

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerSceneX, -0.01, centerSceneZ]} receiveShadow>
        <planeGeometry args={[mapHeight + 5, mapWidth + 5]} />
        <shadowMaterial opacity={0.2} />
      </mesh>

      {/* Occupancy Grid */}
      {showOccupancy && mapData.data && (
        <OccupancyGridCustom
          data={mapData.data}
          width={mapData.width}
          height={mapData.height}
          resolution={resolution}
          originX={originX}
          originY={originY}
        />
      )}

      {/* Zones */}
      {showZones &&
        mapData.zones?.map((zone) => (
          <Zone3D
            key={zone.id}
            id={zone.id}
            name={zone.name}
            x={zone.x}      // ← Direct coordinates
            y={zone.y}      // ← Like robots
            width={zone.width}
            height={zone.height}
            showLabel={showLabels}
          />
        ))}


      {/* Shelves */}
      {showShelves &&
        mapData.shelves?.map((shelf) => (
          <Shelf3D
            key={shelf.id}
            id={shelf.id}
            name={shelf.name}
            x={shelf.current_x || shelf.x || 0}
            y={shelf.current_y || shelf.y || 0}
            yaw={shelf.current_yaw || shelf.yaw}
            level={shelf.level}
            available={shelf.available}
            width={shelf.width}
            height={shelf.height}
            depth={shelf.depth}
            showLabel={showLabels}
          />
        ))}

      {/* Tasks */}
      {showTasks &&
        mapData.tasks?.map((task) => {
          if (!task.pickup_x || !task.pickup_y || !task.drop_x || !task.drop_y) return null;
          return (
            <TaskLine3DCustom
              key={task.id}
              pickupX={task.pickup_x}
              pickupY={task.pickup_y}
              dropX={task.drop_x}
              dropY={task.drop_y}
              status={task.status}
              originX={originX}
              originY={originY}
            />
          );
        })}

      {/* Robots - Using MP 400 model */}
      {showRobots &&
        mapData.robots?.map((robot) => {
          const x = robot.x !== undefined ? robot.x : robot.current_x;
          const y = robot.y !== undefined ? robot.y : robot.current_y;
          if (!x || !y) return null;
          return (
            <Robot3D
              key={robot.id}
              id={robot.id}
              name={robot.name || robot.robot_id}
              x={x}
              y={y}
              yaw={robot.yaw ?? robot.current_yaw ?? 0}
              status={robot.status}
              batteryLevel={robot.battery_level}
              showLabel={showLabels}
              
            />
          );
        })}

      {/* Fog */}
      <fog attach="fog" args={['#0f172a', Math.max(mapWidth, mapHeight) / 2, Math.max(mapWidth, mapHeight) * 3]} />
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WarehouseMap3D() {
  const [mapData, setMapData] = useState<ExtendedMapData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Layer visibility
  const [showGrid, setShowGrid] = useState(true);
  const [showOccupancy, setShowOccupancy] = useState(true);
  const [showRobots, setShowRobots] = useState(true);
  const [showShelves, setShowShelves] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mapResponse, robotsData, shelvesData, tasksData, zonesData] = await Promise.all([
        maps.getMerged(),
        robots.list().catch(() => []),
        shelves.list().catch(() => []),
        tasks.list().catch(() => []),
        zones.list().catch(() => []),
      ]);

      if (mapResponse) {
        setMapData({
          ...mapResponse,
          robots: Array.isArray(robotsData) ? robotsData : [],
          shelves: Array.isArray(shelvesData) ? shelvesData : [],
          tasks: Array.isArray(tasksData) ? tasksData : [],
          zones: Array.isArray(zonesData) ? zonesData : [],
        });
      }
      setLastUpdate(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load map data';
      setError(message);
      console.error('[MAP 3D] Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [robotsData, shelvesData, tasksData] = await Promise.all([
        robots.list().catch(() => []),
        shelves.list().catch(() => []),
        tasks.list().catch(() => []),
      ]);

      setMapData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          robots: Array.isArray(robotsData) ? robotsData : prev.robots,
          shelves: Array.isArray(shelvesData) ? shelvesData : prev.shelves,
          tasks: Array.isArray(tasksData) ? tasksData : prev.tasks,
        };
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[MAP 3D] Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initialize WebSocket subscriptions
  useEffect(() => {
    loadInitialData();

    // Subscribe to telemetry updates
    const unsubscribeTelemetry = onTelemetry((data: any) => {
      const robotId = data.robot_id || data.robot || data.id;
      const x = data.x !== undefined ? data.x : data.current_x;
      const y = data.y !== undefined ? data.y : data.current_y;
      const yaw = data.yaw !== undefined ? data.yaw : data.current_yaw ?? 0;

      if (robotId && x !== undefined && y !== undefined) {
        setMapData((prev) => {
          if (!prev?.robots) return prev;

          const found = prev.robots.find((r) => r.id === robotId || r.robot_id === robotId);
          if (!found) return prev;

          return {
            ...prev,
            robots: prev.robots.map((r) =>
              r.id === robotId || r.robot_id === robotId
                ? {
                    ...r,
                    x: Number(x),
                    y: Number(y),
                    yaw: Number(yaw),
                    current_x: Number(x),
                    current_y: Number(y),
                    current_yaw: Number(yaw),
                    status: data.status ?? r.status,
                    battery_level: data.battery_level ?? r.battery_level,
                  }
                : r,
            ),
          };
        });
        setLastUpdate(new Date());
      }
    });

    // Subscribe to robot updates
    const unsubscribeRobot = onRobotUpdate((data: any) => {
      setMapData((prev) => {
        if (!prev?.robots) return prev;
        return {
          ...prev,
          robots: prev.robots.map((r) =>
            r.id === data.robot_id || r.robot_id === data.robot_id || r.id === data.id
              ? {
                  ...r,
                  x: data.x !== undefined ? data.x : data.current_x !== undefined ? data.current_x : r.x,
                  y: data.y !== undefined ? data.y : data.current_y !== undefined ? data.current_y : r.y,
                  yaw: data.yaw !== undefined ? data.yaw : data.current_yaw !== undefined ? data.current_yaw : r.yaw,
                  status: data.status ?? r.status,
                  battery_level: data.battery_level ?? r.battery_level,
                }
                : r,
            ),
          };
        });
      setLastUpdate(new Date());
    });

    // Subscribe to shelf updates
    const unsubscribeShelf = onShelfUpdate((data: any) => {
      setMapData((prev) => {
        if (!prev?.shelves) return prev;
        return {
          ...prev,
          shelves: prev.shelves.map((s) =>
            s.id === data.shelf_id
              ? {
                  ...s,
                  x: data.x !== undefined ? data.x : data.current_x !== undefined ? data.current_x : s.x,
                  y: data.y !== undefined ? data.y : data.current_y !== undefined ? data.current_y : s.y,
                  current_x: data.x !== undefined ? data.x : data.current_x !== undefined ? data.current_x : s.current_x,
                  current_y: data.y !== undefined ? data.y : data.current_y !== undefined ? data.current_y : s.current_y,
                  current_yaw: data.yaw !== undefined ? data.yaw : data.current_yaw !== undefined ? data.current_yaw : s.current_yaw,
                }
                : s,
            ),
          };
        });
      setLastUpdate(new Date());
    });

    // Position refresh interval
    const positionRefreshInterval = setInterval(async () => {
      try {
        const [robotsData, shelvesData] = await Promise.all([
          robots.list().catch(() => []),
          shelves.list().catch(() => []),
        ]);

        setMapData((prev) => {
          if (!prev) return prev;

          const updatedRobots = (Array.isArray(robotsData) ? robotsData : []).map((r: any) => {
            const oldRobot = prev.robots?.find((oldR) => oldR.id === r.id);
            if (!oldRobot) return r;

            return {
              ...oldRobot,
              x: r.x !== undefined ? r.x : r.current_x,
              y: r.y !== undefined ? r.y : r.current_y,
              yaw: r.yaw !== undefined ? r.yaw : r.current_yaw,
              battery_level: r.battery_level ?? oldRobot.battery_level,
            };
          });

          const updatedShelves = (Array.isArray(shelvesData) ? shelvesData : []).map((s: any) => {
            const oldShelf = prev.shelves?.find((oldS) => oldS.id === s.id);
            if (!oldShelf) return s;

            return {
              ...oldShelf,
              x: s.x !== undefined ? s.x : s.current_x,
              y: s.y !== undefined ? s.y : s.current_y,
              yaw: s.yaw !== undefined ? s.yaw : s.current_yaw,
            };
          });

          return {
            ...prev,
            robots: updatedRobots,
            shelves: updatedShelves,
          };
        });
      } catch (error) {
        // Silently ignore position refresh errors
      }
    }, 100);

    // Task status refresh interval
    const taskStatusInterval = setInterval(async () => {
      try {
        const tasksData = await tasks.list().catch(() => []);
        if (Array.isArray(tasksData)) {
          setMapData((prev) => {
            if (!prev?.tasks) return prev;

            const updatedTasks = tasksData.map((t: any) => {
              const oldTask = prev.tasks?.find((oldT) => oldT.id === t.id);
              if (!oldTask) return t;

              return {
                ...oldTask,
                status: t.status,
              };
            });

            return {
              ...prev,
              tasks: updatedTasks,
            };
          });
        }
      } catch (error) {
        // Silently ignore task status refresh errors
      }
    }, 200);

    return () => {
      unsubscribeTelemetry();
      unsubscribeRobot();
      unsubscribeShelf();
      clearInterval(positionRefreshInterval);
      clearInterval(taskStatusInterval);
    };
  }, [loadInitialData]);

  // Calculate stats
  const activeRobots = mapData?.robots?.filter((r) => r.status !== 'OFFLINE').length || 0;
  const availableShelves = mapData?.shelves?.filter((s) => s.available).length || 0;
  const occupiedShelves = mapData?.shelves?.filter((s) => !s.available).length || 0;
  const activeTasks = mapData?.tasks?.filter((t) => !['COMPLETED', 'CANCELLED', 'ERROR'].includes(t.status)).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse</h1>
            <p className="text-accent-400">Real-time robot and shelf location tracking</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-accent-900 to-accent-950 rounded-xl shadow-2xl border border-accent-700 p-12 flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-400/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-accent-300 text-lg">Loading warehouse map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map 3D</h1>
            <p className="text-accent-400">Real-time robot and shelf location tracking</p>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-red-300 font-semibold mb-1">Failed to Load Map</h2>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      {/* Header */}
      <header className="flex-shrink-0 bg-accent-900 border-b border-accent-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary-400" />
              <div>
                <h1 className="text-lg font-bold text-white">Warehouse Map 3D</h1>
                <p className="text-xs text-accent-400">Real-time visualization with MP 400 robots</p>
              </div>
            </div>
            <div className="h-6 w-px bg-accent-700" />
            <div className="text-xs text-accent-400">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white transition-all border border-accent-700 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white transition-all border border-accent-700"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-accent-950 border-r border-accent-700 flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Stats */}
          <div className="p-4 border-b border-accent-700">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-400" />
              Statistics
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-accent-800 border border-primary-500/30">
                <p className="text-2xl font-bold text-white">{activeRobots}</p>
                <p className="text-xs text-accent-400">Active Robots</p>
              </div>
              <div className="p-3 rounded-lg bg-accent-800 border border-green-500/30">
                <p className="text-2xl font-bold text-white">{availableShelves}</p>
                <p className="text-xs text-accent-400">Available</p>
              </div>
              <div className="p-3 rounded-lg bg-accent-800 border border-red-500/30">
                <p className="text-2xl font-bold text-white">{occupiedShelves}</p>
                <p className="text-xs text-accent-400">Occupied</p>
              </div>
              <div className="p-3 rounded-lg bg-accent-800 border border-yellow-500/30">
                <p className="text-2xl font-bold text-white">{activeTasks}</p>
                <p className="text-xs text-accent-400">Tasks</p>
              </div>
            </div>
          </div>

          {/* Layer Controls */}
          <div className="p-4 border-b border-accent-700">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-400" />
              Layers
            </h2>
            <div className="space-y-2">
              {[
                { key: 'grid', label: 'Grid', state: showGrid, setState: setShowGrid },
                { key: 'occupancy', label: 'Occupancy Map', state: showOccupancy, setState: setShowOccupancy },
                { key: 'robots', label: 'MP 400 Robots', state: showRobots, setState: setShowRobots },
                { key: 'shelves', label: 'Shelves', state: showShelves, setState: setShowShelves },
                { key: 'zones', label: 'Zones', state: showZones, setState: setShowZones },
                { key: 'tasks', label: 'Tasks', state: showTasks, setState: setShowTasks },
                { key: 'labels', label: 'Labels', state: showLabels, setState: setShowLabels },
              ].map(({ key, label, state, setState }) => (
                <button
                  key={key}
                  onClick={() => setState(!state)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                    state ? 'bg-primary-500/30 text-white' : 'bg-accent-800 text-accent-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">{label}</span>
                  {state ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4 flex-1 overflow-auto">
            <h2 className="text-sm font-semibold text-white mb-3">Legend</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-accent-300">MP 400 Robot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-accent-300">Available Shelf</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-accent-300">Occupied Shelf</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-accent-300">Zone</span>
              </div>
              <div className="h-px bg-accent-700 my-2" />
              <div className="text-xs text-accent-400 space-y-1">
                <p>🟢 IDLE - Available</p>
                <p>🟡 BUSY - In operation</p>
                <p>🟠 CHARGING - At charger</p>
                <p>🔴 ERROR - Fault state</p>
              </div>
            </div>
          </div>
        </aside>

        {/* 3D Canvas */}
        <main className="flex-1 relative bg-black">
          {isLoading && <LoadingSpinner />}

          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{
              position: [20, 30, 40],
              fov: 50,
              near: 0.1,
              far: 500,
            }}
          >
            <PerspectiveCamera makeDefault position={[20, 30, 40]} fov={50} />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={200}
              maxPolarAngle={Math.PI / 1.8}
            />

            <Suspense fallback={null}>
              <Scene3D
                mapData={mapData}
                showGrid={showGrid}
                showOccupancy={showOccupancy}
                showRobots={showRobots}
                showShelves={showShelves}
                showZones={showZones}
                showTasks={showTasks}
                showLabels={showLabels}
              />
            </Suspense>

            {showStats && <Stats />}
          </Canvas>

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-4 py-3 rounded-lg border border-accent-700 text-xs text-accent-300 space-y-1">
            <div>🖱️ Drag to rotate</div>
            <div>🔍 Scroll to zoom</div>
            <div>🖱️ Right-click to pan</div>
          </div>

          {/* Stats button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-black/60 hover:bg-black/80 text-accent-300 hover:text-white transition-all border border-accent-700 text-xs font-medium"
          >
            {showStats ? 'Hide' : 'Show'} Stats
          </button>
        </main>
      </div>
    </div>
  );
}