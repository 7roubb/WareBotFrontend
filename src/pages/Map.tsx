import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertCircle,
  Activity,
  Layers,
  Navigation,
  Zap,
  Package,
} from 'lucide-react';
import { maps, robots, shelves, tasks, zones } from '@/services/api';
import { subscribeToMapUpdates, onRobotUpdate, onShelfUpdate, onTelemetry } from '@/services/websocket';
import type { MapData, Robot, Shelf, Task, Zone } from '@/types';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default function WarehouseMap() {
  const [mapData, setMapData] = useState<ExtendedMapData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showShelves, setShowShelves] = useState(true);
  const [showRobots, setShowRobots] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showZones, setShowZones] = useState(true);

  // Helper function to convert yaw angle to compass direction
  const getHeadingDirection = (yaw: number): string => {
    const normalized = ((yaw % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'N';
    if (normalized >= 22.5 && normalized < 67.5) return 'NE';
    if (normalized >= 67.5 && normalized < 112.5) return 'E';
    if (normalized >= 112.5 && normalized < 157.5) return 'SE';
    if (normalized >= 157.5 && normalized < 202.5) return 'S';
    if (normalized >= 202.5 && normalized < 247.5) return 'SW';
    if (normalized >= 247.5 && normalized < 292.5) return 'W';
    if (normalized >= 292.5 && normalized < 337.5) return 'NW';
    return 'N';
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ worldX: number; worldY: number; canvasX: number; canvasY: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Safe numeric getters
  const mapWidth = useMemo(() => (mapData ? Number(mapData.width || 0) : 0), [mapData]);
  const mapHeight = useMemo(() => (mapData ? Number(mapData.height || 0) : 0), [mapData]);
  const mapResolution = useMemo(() => (mapData ? Number(mapData.resolution ?? 0.05) : 0.05), [mapData]);

  const occupancyGrid = useMemo(
    () => mapData?.occupancy_grid || mapData?.data || null,
    [mapData?.occupancy_grid, mapData?.data]
  );

  const hasGrid =
    !!mapData &&
    Number.isFinite(mapWidth) &&
    Number.isFinite(mapHeight) &&
    Array.isArray(occupancyGrid) &&
    occupancyGrid.length > 0 &&
    mapWidth > 0 &&
    mapHeight > 0;

  // Color function for occupancy cells with improved color scheme
  const getCellColorRGB = useCallback((value: number): [number, number, number] => {
    // Professional color scheme
    if (value === 100) return [239, 68, 68]; // Obstacles: bright red (#ef4444)
    if (value === 0) return [51, 65, 85]; // Free space: slate-700
    if (value === -1 || value < 0) return [30, 41, 59]; // Unknown: slate-900
    if (value > 0 && value < 100) {
      // Gradient from free (slate) to obstacle (red)
      const intensity = value / 100;
      const r = Math.floor(51 + (239 - 51) * intensity);
      const g = Math.floor(65 + (68 - 65) * intensity);
      const b = Math.floor(85 + (68 - 85) * intensity);
      return [r, g, b];
    }
    return [30, 41, 59];
  }, []);

  // Convert world coordinates (meters) -> percentage inside the map container
  const worldToPercent = useCallback(
    (x: number, y: number): { left: number; top: number } => {
      if (!hasGrid || !mapData) {
        const xs = [
          ...(mapData?.robots?.map((r) => r.x || r.current_x || 0) || []),
          ...(mapData?.shelves?.map((s) => s.x || s.current_x || 0) || []),
        ];
        const ys = [
          ...(mapData?.robots?.map((r) => r.y || r.current_y || 0) || []),
          ...(mapData?.shelves?.map((s) => s.y || s.current_y || 0) || []),
        ];

        const minX = xs.length ? Math.min(...xs, 0) : 0;
        const maxX = xs.length ? Math.max(...xs, 10) : 10;
        const minY = ys.length ? Math.min(...ys, 0) : 0;
        const maxY = ys.length ? Math.max(...ys, 10) : 10;

        const gridWidth = maxX - minX || 1;
        const gridHeight = maxY - minY || 1;

        return {
          left: Math.max(0, Math.min(100, ((x - minX) / gridWidth) * 100)),
          top: Math.max(0, Math.min(100, (1 - (y - minY) / gridHeight) * 100)),
        };
      }

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

      const cellX = (x - originX) / mapResolution;
      const cellY = (y - originY) / mapResolution;

      return {
        left: Math.max(0, Math.min(100, (cellX / Math.max(mapWidth, 1)) * 100)),
        top: Math.max(0, Math.min(100, (1 - cellY / Math.max(mapHeight, 1)) * 100)),
      };
    },
    [hasGrid, mapData, mapWidth, mapHeight, mapResolution]
  );

  // Convert percentage position back to world coordinates
  const percentToWorld = useCallback(
    (leftPercent: number, topPercent: number): { x: number; y: number } => {
      if (!hasGrid || !mapData) return { x: 0, y: 0 };

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

      const cellX = (leftPercent / 100) * mapWidth;
      const cellY = ((100 - topPercent) / 100) * mapHeight;

      return {
        x: originX + cellX * mapResolution,
        y: originY + cellY * mapResolution,
      };
    },
    [hasGrid, mapData, mapWidth, mapHeight, mapResolution]
  );

  // Handle mouse move on map container for coordinate display
  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!mapContainerRef.current) return;

      const rect = mapContainerRef.current.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      const leftPercent = (canvasX / rect.width) * 100;
      const topPercent = (canvasY / rect.height) * 100;

      const { x: worldX, y: worldY } = percentToWorld(leftPercent, topPercent);

      setMouseCoords({
        worldX: Number(worldX.toFixed(2)),
        worldY: Number(worldY.toFixed(2)),
        canvasX: Number(canvasX.toFixed(0)),
        canvasY: Number(canvasY.toFixed(0)),
      });
    },
    [percentToWorld]
  );

  const handleMapMouseLeave = useCallback(() => {
    setMouseCoords(null);
  }, []);

  // Load initial map data from endpoint
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mapResponse = await maps.getMerged();
      console.log('[MAP DEBUG] Occupancy grid response:', mapResponse);
      
      // Load entities in parallel
      const [robotsData, shelvesData, tasksData, zonesData] = await Promise.all([
        robots.list().catch(() => []),
        shelves.list().catch(() => []),
        tasks.list().catch(() => []),
        zones.list().catch(() => []),
      ]);

      console.log('[MAP DEBUG] Robots API:', robotsData);
      console.log('[MAP DEBUG] Shelves API:', shelvesData);
      console.log('[MAP DEBUG] Tasks API:', tasksData);
      console.log('[MAP DEBUG] Zones API:', zonesData);

      // Map robots with position aliases
      const mappedRobots = (Array.isArray(robotsData) ? robotsData : []).map((r: any) => ({
        ...r,
        // Add robot position data from telemetry fields if available
        x: r.x !== undefined ? r.x : r.current_x,
        y: r.y !== undefined ? r.y : r.current_y,
        yaw: r.yaw !== undefined ? r.yaw : r.current_yaw,
      }));

      // Map shelves with position aliases
      const mappedShelves = (Array.isArray(shelvesData) ? shelvesData : []).map((s: any) => ({
        ...s,
        // Use current location for map display
        x: s.x !== undefined ? s.x : s.current_x,
        y: s.y !== undefined ? s.y : s.current_y,
        yaw: s.yaw !== undefined ? s.yaw : s.current_yaw,
      }));

      console.log('[MAP DEBUG] Mapped robots:', mappedRobots);
      console.log('[MAP DEBUG] Mapped shelves:', mappedShelves);
      console.log('[MAP DEBUG] Total entities - Robots:', mappedRobots.length, 'Shelves:', mappedShelves.length, 'Zones:', Array.isArray(zonesData) ? zonesData.length : 0, 'Tasks:', Array.isArray(tasksData) ? tasksData.length : 0);

      if (mapResponse) {
        setMapData({
          ...mapResponse,
          robots: mappedRobots,
          shelves: mappedShelves,
          tasks: Array.isArray(tasksData) ? tasksData : [],
          zones: Array.isArray(zonesData) ? zonesData : [],
        });
      }
      setLastUpdate(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load map data';
      setError(message);
      console.error('[MAP DEBUG] Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh map data
  const refreshMapData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await maps.getMerged();
      if (data) {
        setMapData(data);
      }
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[MAP] Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initialize data and WebSocket subscriptions
  useEffect(() => {
    loadInitialData();

    // Subscribe to map updates via WebSocket
    const unsubscribeMap = subscribeToMapUpdates((data: ExtendedMapData) => {
      console.log('[MAP] Received map update from WebSocket');
      if (data) {
        setMapData(data);
        setLastUpdate(new Date());
        setWsConnected(true);
      }
    });

    // Subscribe to real-time telemetry updates (PRIMARY SOURCE FOR POSITION & SENSORS)
    const unsubscribeTelemetry = onTelemetry((data: any) => {
      console.log('[MAP] Telemetry Update:', {
        robot_id: data.robot_id || data.robot || data.id,
        position: { x: data.x, y: data.y },
        yaw: data.yaw,
        status: data.status,
        battery: data.battery_level,
        cpu: data.cpu_usage,
        ram: data.ram_usage,
        temp: data.temperature
      });

      const robotId = data.robot_id || data.robot || data.id;
      const x = data.x !== undefined ? data.x : data.current_x;
      const y = data.y !== undefined ? data.y : data.current_y;
      const yaw = data.yaw !== undefined ? data.yaw : (data.current_yaw ?? 0);

      if (robotId && x !== undefined && y !== undefined) {
        setMapData((prev) => {
          if (!prev?.robots) return prev;
          
          const found = prev.robots.find(r => r.id === robotId || r.robot_id === robotId);
          if (!found) {
            console.log(`[MAP] Robot ${robotId} not found in local data, skipping update`);
            return prev;
          }

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
                    cpu_usage: data.cpu_usage !== undefined ? Number(data.cpu_usage) : r.cpu_usage,
                    ram_usage: data.ram_usage !== undefined ? Number(data.ram_usage) : r.ram_usage,
                    battery_level: data.battery_level !== undefined ? Number(data.battery_level) : r.battery_level,
                    temperature: data.temperature !== undefined ? Number(data.temperature) : r.temperature,
                  }
                : r
            ),
          };
        });
        setLastUpdate(new Date());
      }
    });

    // Subscribe to robot position updates (FALLBACK if telemetry not received)
    const unsubscribeRobot = onRobotUpdate((data: any) => {
      console.log('[MAP] Robot Update (fallback):', data);
      setMapData((prev) => {
        if (!prev?.robots) return prev;
        return {
          ...prev,
          robots: prev.robots.map((r) =>
            r.id === data.robot_id || r.robot_id === data.robot_id || r.id === data.id
              ? {
                  ...r,
                  x: data.x !== undefined ? data.x : (data.current_x !== undefined ? data.current_x : r.x),
                  y: data.y !== undefined ? data.y : (data.current_y !== undefined ? data.current_y : r.y),
                  yaw: data.yaw !== undefined ? data.yaw : (data.current_yaw !== undefined ? data.current_yaw : r.yaw),
                  status: data.status ?? r.status,
                  cpu_usage: data.cpu_usage !== undefined ? Number(data.cpu_usage) : r.cpu_usage,
                  ram_usage: data.ram_usage !== undefined ? Number(data.ram_usage) : r.ram_usage,
                  battery_level: data.battery_level !== undefined ? Number(data.battery_level) : r.battery_level,
                  temperature: data.temperature !== undefined ? Number(data.temperature) : r.temperature,
                }
              : r
          ),
        };
      });
      setLastUpdate(new Date());
    });

    // Subscribe to shelf location updates
    const unsubscribeShelf = onShelfUpdate((data: any) => {
      console.log('[MAP] Received shelf update from WebSocket:', data);
      setMapData((prev) => {
        if (!prev?.shelves) return prev;
        return {
          ...prev,
          shelves: prev.shelves.map((s) =>
            s.id === data.shelf_id
              ? {
                  ...s,
                  x: data.x !== undefined ? data.x : (data.current_x !== undefined ? data.current_x : s.x),
                  y: data.y !== undefined ? data.y : (data.current_y !== undefined ? data.current_y : s.y),
                  current_x: data.x !== undefined ? data.x : (data.current_x !== undefined ? data.current_x : s.current_x),
                  current_y: data.y !== undefined ? data.y : (data.current_y !== undefined ? data.current_y : s.current_y),
                  current_yaw: data.yaw !== undefined ? data.yaw : (data.current_yaw !== undefined ? data.current_yaw : s.current_yaw),
                }
              : s
          ),
        };
      });
      setLastUpdate(new Date());
    });

    // Background refresh interval for POSITION ONLY (every 0.1 seconds for smooth movement)
    const positionRefreshInterval = setInterval(async () => {
      try {
        const [robotsData, shelvesData] = await Promise.all([
          robots.list().catch(() => []),
          shelves.list().catch(() => []),
        ]);

        setMapData((prev) => {
          if (!prev) return prev;
          
          // Map updated robots - UPDATE POSITION ONLY
          const updatedRobots = (Array.isArray(robotsData) ? robotsData : []).map((r: any) => {
            const oldRobot = prev.robots?.find(oldR => oldR.id === r.id);
            if (!oldRobot) return r;
            
            return {
              ...oldRobot,
              x: r.x !== undefined ? r.x : r.current_x,
              y: r.y !== undefined ? r.y : r.current_y,
              yaw: r.yaw !== undefined ? r.yaw : r.current_yaw,
            };
          });

          // Map updated shelves - UPDATE POSITION ONLY
          const updatedShelves = (Array.isArray(shelvesData) ? shelvesData : []).map((s: any) => {
            const oldShelf = prev.shelves?.find(oldS => oldS.id === s.id);
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
    }, 100); // Update position every 0.1 seconds (100ms)

    // Background refresh interval for TASK STATUS ONLY (every 0.2 seconds)
    const taskStatusInterval = setInterval(async () => {
      try {
        const tasksData = await tasks.list().catch(() => []);
        if (Array.isArray(tasksData)) {
          setMapData((prev) => {
            if (!prev?.tasks) return prev;
            
            const updatedTasks = tasksData.map((t: any) => {
              const oldTask = prev.tasks?.find(oldT => oldT.id === t.id);
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
    }, 200); // Update task status every 0.2 seconds (200ms)

    return () => {
      unsubscribeMap();
      unsubscribeTelemetry();
      unsubscribeRobot();
      unsubscribeShelf();
      clearInterval(positionRefreshInterval);
      clearInterval(taskStatusInterval);
    };
  }, [loadInitialData]);

  // Draw occupancy grid to canvas
  useEffect(() => {
    if (!mapData || !hasGrid || !showGrid) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = mapWidth;
    const height = mapHeight;
    const gridData = occupancyGrid;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const imageData = ctx.createImageData(width, height);
    const buf = imageData.data;

    for (let i = 0; i < (gridData?.length || 0); i++) {
      const row = Math.floor(i / width);
      const col = i % width;
      const canvasRow = height - 1 - row;
      const offset = (canvasRow * width + col) * 4;

      const val = Number(gridData?.[i] || 0);
      const [r, g, b] = getCellColorRGB(val);
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
      buf[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [mapData, hasGrid, showGrid, mapWidth, mapHeight, occupancyGrid, getCellColorRGB]);

  const activeRobots = mapData?.robots?.filter((r) => r.status !== 'OFFLINE').length || 0;
  const busyShelves = mapData?.shelves?.filter((s) => !s.available).length || 0;
  const availableShelves = mapData?.shelves?.filter((s) => s.available).length || 0;
  const activeTasks = mapData?.tasks?.filter((t) => !['COMPLETED', 'CANCELLED', 'ERROR'].includes(t.status)).length || 0;

  const aspectRatio = hasGrid ? (mapHeight / Math.max(mapWidth, 1)) : 1;
  const cappedAspectRatio = Math.min(aspectRatio, 0.75);
  const aspectPadding = `${cappedAspectRatio * 100}%`;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map</h1>
            <p className="text-accent-400">Real-time robot and shelf location tracking</p>
          </div>
        </div>
        <div className="bg-gradient-card rounded-xl shadow-2xl border border-accent-700 p-12 flex items-center justify-center">
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
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map</h1>
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map</h1>
          <p className="text-accent-400">Real-time robot and shelf location tracking</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 rounded-xl p-6 border border-primary-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-200 mb-1 font-medium">Active Robots</p>
              <p className="text-4xl font-bold text-white">{activeRobots}</p>
            </div>
            <div className="w-14 h-14 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <Navigation className="w-7 h-7 text-primary-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-6 border border-green-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-200 mb-1 font-medium">Available Shelves</p>
              <p className="text-4xl font-bold text-white">{availableShelves}</p>
            </div>
            <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
              <div className="w-7 h-7 bg-green-400 rounded-lg"></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-6 border border-red-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-200 mb-1 font-medium">Occupied Shelves</p>
              <p className="text-4xl font-bold text-white">{busyShelves}</p>
            </div>
            <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center">
              <div className="w-7 h-7 bg-red-400 rounded-lg"></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-6 border border-yellow-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-200 mb-1 font-medium">Active Tasks</p>
              <p className="text-4xl font-bold text-white">{activeTasks}</p>
            </div>
            <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Layers className="w-7 h-7 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      {(!(mapData?.robots?.length || 0) || !(mapData?.shelves?.length || 0)) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-300 text-sm">
            <strong>Debug Info:</strong> Robots: {mapData?.robots?.length || 0} | Shelves: {mapData?.shelves?.length || 0} | Zones: {mapData?.zones?.length || 0} | Tasks: {mapData?.tasks?.length || 0}
            <br />
            <span className="text-xs text-blue-400 mt-2 inline-block">Open DevTools Console (F12) to see detailed API responses with [MAP DEBUG] prefix</span>
          </p>
        </div>
      )}

      {/* Map Container */}
      <div className={`bg-gradient-card rounded-xl shadow-2xl border border-accent-700 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-accent-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Layers className="w-5 h-5 mr-2 text-primary-400" />
              Map Visualization
            </h2>
            <div className="flex items-center space-x-2 text-xs text-accent-400">
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Layer Controls */}
            <div className="flex items-center space-x-1 bg-accent-800 rounded-lg p-1 border border-accent-700">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  showGrid ? 'bg-primary-500 text-white' : 'text-accent-400 hover:text-white'
                }`}
                title="Toggle grid"
              >
                Grid
              </button>
              <button
                onClick={() => setShowShelves(!showShelves)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  showShelves ? 'bg-green-500 text-white' : 'text-accent-400 hover:text-white'
                }`}
                title="Toggle shelves"
              >
                Shelves
              </button>
              <button
                onClick={() => setShowRobots(!showRobots)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  showRobots ? 'bg-yellow-500 text-white' : 'text-accent-400 hover:text-white'
                }`}
                title="Toggle robots"
              >
                Robots
              </button>
              <button
                onClick={() => setShowZones(!showZones)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  showZones ? 'bg-purple-500 text-white' : 'text-accent-400 hover:text-white'
                }`}
                title="Toggle zones"
              >
                Zones
              </button>
              <button
                onClick={() => setShowTasks(!showTasks)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  showTasks ? 'bg-blue-500 text-white' : 'text-accent-400 hover:text-white'
                }`}
                title="Toggle tasks"
              >
                Tasks
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-accent-800 rounded-lg p-1 border border-accent-700">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="p-1.5 text-accent-400 hover:text-white transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs text-accent-300 font-medium">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                className="p-1.5 text-accent-400 hover:text-white transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={refreshMapData}
              disabled={isRefreshing}
              className={`p-2 bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white rounded-lg transition-all border border-accent-700 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh map data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white rounded-lg transition-all border border-accent-700"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Map View */}
        <div className="p-4">
          {/* Legend */}
          <div className="mb-4 flex items-center justify-between overflow-x-auto pb-2">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="w-6 h-6 rounded border border-accent-600" style={{ backgroundColor: '#334155' }}></div>
                <span className="text-accent-300 font-medium">Free Space</span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="w-6 h-6 rounded border border-accent-600" style={{ backgroundColor: '#ef4444' }}></div>
                <span className="text-accent-300 font-medium">Obstacles</span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="w-6 h-6 rounded border border-accent-600" style={{ backgroundColor: '#1e293b' }}></div>
                <span className="text-accent-300 font-medium">Unknown</span>
              </div>
            </div>
            
            {/* Coordinates Display */}
            {mouseCoords && (
              <div className="flex items-center space-x-4 text-xs text-accent-300 bg-accent-800/50 px-3 py-2 rounded border border-accent-700">
                <span><strong>World:</strong> ({mouseCoords.worldX.toFixed(2)}, {mouseCoords.worldY.toFixed(2)})</span>
                <span className="text-accent-500">|</span>
                <span><strong>Canvas:</strong> ({mouseCoords.canvasX}, {mouseCoords.canvasY})</span>
              </div>
            )}
          </div>

          <div
            ref={mapContainerRef}
            className="relative bg-accent-900 rounded-lg border-2 border-accent-700 overflow-hidden shadow-inner cursor-crosshair"
            style={{
              width: '100%',
              paddingBottom: aspectPadding,
            }}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={handleMapMouseLeave}
          >
            <div
              className="absolute inset-0 overflow-auto"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
              }}
            >
              <>
                {/* Canvas map */}
                {showGrid && hasGrid && (
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full block"
                    style={{
                      imageRendering: 'pixelated',
                      display: 'block',
                    }}
                  />
                )}

                {!hasGrid && showGrid && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Layers className="w-12 h-12 text-accent-500 mx-auto mb-3" />
                      <p className="text-accent-400 text-sm font-medium">No map grid available</p>
                      <p className="text-accent-500 text-xs mt-1">Waiting for occupancy grid data</p>
                    </div>
                  </div>
                )}

                {/* Zones */}
                {showZones &&
                  mapData?.zones?.map((zone: Zone) => {
                    const { left, top } = worldToPercent(zone.x, zone.y);
                    return (
                      <div
                        key={zone.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                        }}
                      >
                        <div className="group relative">
                          <div className="absolute inset-0 bg-purple-500 rounded-full blur-lg opacity-30"></div>
                          <div className="relative w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-xl border-4 border-accent-900 cursor-pointer hover:scale-110 transition-transform">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20">
                            <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              <div className="text-white font-bold text-sm mb-1">Zone {zone.zone_id}</div>
                              <div className="text-accent-300 text-xs">
                                Position: ({zone.x.toFixed(1)}, {zone.y.toFixed(1)})
                              </div>
                              {zone.name && <div className="text-accent-300 text-xs">{zone.name}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Shelves */}
                {showShelves &&
                  mapData?.shelves?.map((shelf: Shelf) => {
                    const { left, top } = worldToPercent(shelf.current_x || 0, shelf.current_y || 0);
                    return (
                      <div
                        key={shelf.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                        }}
                      >
                        <div className="group relative">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all transform hover:scale-110 cursor-pointer overflow-hidden ${
                              shelf.available
                                ? 'bg-gradient-to-br from-green-400 to-green-600 hover:from-green-300 hover:to-green-500'
                                : 'bg-gradient-to-br from-red-400 to-red-600 hover:from-red-300 hover:to-red-500'
                            }`}
                            style={{
                              transform: `rotate(${shelf.current_yaw || shelf.yaw || 0}deg)`,
                              transition: 'transform 0.3s ease'
                            }}
                          >
                            {/* Direction pointer - triangle pointing up */}
                            <div className="absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full opacity-90"></div>
                            <div className="absolute top-3 left-1.5 w-1 h-1 bg-white opacity-60 rounded-full"></div>
                            <div className="absolute top-3 right-1.5 w-1 h-1 bg-white opacity-60 rounded-full"></div>
                          </div>
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20">
                            <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              <div className="text-white font-bold text-sm mb-1">Shelf {shelf.id}</div>
                              <div className="text-accent-300 text-xs">
                                Position: ({shelf.current_x?.toFixed(1) || 0}, {shelf.current_y?.toFixed(1) || 0})
                              </div>
                              <div className="text-accent-300 text-xs">Level: {shelf.level}</div>
                              {(shelf.current_yaw !== null && shelf.current_yaw !== undefined) || (shelf.yaw !== null && shelf.yaw !== undefined) ? (
                                <div className="text-accent-300 text-xs">
                                  Yaw: {(shelf.current_yaw ?? shelf.yaw ?? 0).toFixed(2)}°
                                </div>
                              ) : null}
                              <div
                                className={`text-xs font-medium mt-1 ${shelf.available ? 'text-green-400' : 'text-red-400'}`}
                              >
                                {shelf.available ? 'Available' : 'Occupied'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Robots */}
                {showRobots &&
                  mapData?.robots?.map((robot: Robot) => {
                    if (!robot.x || !robot.y) return null;
                    const { left, top } = worldToPercent(robot.x, robot.y);
                    // Debug: log robot yaw value
                    if (robot.yaw !== undefined && robot.yaw !== null) {
                      console.log(`[MAP] Robot ${robot.robot_id} yaw: ${robot.yaw}°`);
                    }
                    return (
                      <div
                        key={robot.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          transition: 'all 0.12s linear',
                        }}
                      >
                        <div className="group relative">
                          <div className="relative">
                            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-50 animate-pulse"></div>
                              <svg 
                              className="w-10 h-10 shadow-xl filter drop-shadow-lg hover:drop-shadow-xl transition-all hover:scale-110 cursor-pointer"
                              viewBox="0 0 40 40"
                              style={{
                                transformOrigin: '50% 50%',
                                transform: `rotate(${robot.yaw ?? 0}deg)`,
                                transition: 'transform 0.12s linear',
                                display: 'block'
                              }}
                            >
                              {/* Outer circle */}
                              <circle cx="20" cy="20" r="18" fill="url(#robotGradient)" stroke="#1f2937" strokeWidth="3"/>
                              <defs>
                                <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" style={{stopColor: '#fcd34d', stopOpacity: 1}} />
                                  <stop offset="100%" style={{stopColor: '#eab308', stopOpacity: 1}} />
                                </linearGradient>
                              </defs>
                              {/* Direction arrow pointing up */}
                              {/* Arrow tip (top) */}
                              <polygon points="20,6 24,14 16,14" fill="#1f2937" />
                              {/* Arrow shaft */}
                              <rect x="18" y="14" width="4" height="14" fill="#1f2937" />
                              {/* Center dot */}
                              <circle cx="20" cy="20" r="2.5" fill="#fef3c7" opacity="0.8" />
                            </svg>
                          </div>
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20">
                            <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              <div className="text-white font-bold text-sm mb-1">{robot.name || robot.robot_id}</div>
                              <div className="text-accent-300 text-xs">
                                Position: ({robot.x?.toFixed(1) || 0}, {robot.y?.toFixed(1) || 0})
                              </div>
                              {robot.yaw !== null && robot.yaw !== undefined && (
                                <div className="text-accent-300 text-xs">
                                  Yaw: {robot.yaw?.toFixed(2) || 0}° 
                                  <span className="text-yellow-400 font-semibold ml-1">
                                    {getHeadingDirection(robot.yaw || 0)}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`text-xs font-medium mt-1 ${
                                  robot.status === 'IDLE'
                                    ? 'text-blue-400'
                                    : robot.status === 'BUSY'
                                    ? 'text-green-400'
                                    : robot.status === 'ERROR'
                                    ? 'text-red-400'
                                    : 'text-accent-400'
                                }`}
                              >
                                Status: {robot.status}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Tasks (connection lines) */}
                {showTasks &&
                  mapData?.tasks?.map((task: Task) => {
                    if (!task.pickup_x || !task.pickup_y || !task.drop_x || !task.drop_y) return null;
                    const pickup = worldToPercent(task.pickup_x, task.pickup_y);
                    const drop = worldToPercent(task.drop_x, task.drop_y);

                    const container = canvasRef.current?.parentElement;
                    if (!container) return null;

                    const pickupPx = (pickup.left / 100) * container.offsetWidth;
                    const pickupPy = (pickup.top / 100) * container.offsetHeight;
                    const dropPx = (drop.left / 100) * container.offsetWidth;
                    const dropPy = (drop.top / 100) * container.offsetHeight;

                    return (
                      <svg
                        key={task.id}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ zIndex: 10 }}
                      >
                        <line x1={pickupPx} y1={pickupPy} x2={dropPx} y2={dropPy} stroke="#fbbf24" strokeWidth="2" strokeDasharray="5,5" opacity="0.7" />
                        <circle cx={dropPx} cy={dropPy} r="6" fill="#fbbf24" opacity="0.6" />
                      </svg>
                    );
                  })}
              </>
            </div>
          </div>
        </div>
      </div>

      {/* Map Metadata */}
      {mapData && (
        <div className="bg-gradient-card rounded-xl shadow-neo p-6 border border-accent-700">
          <h2 className="text-xl font-bold mb-4 flex items-center text-white">
            <Layers className="w-5 h-5 mr-2 text-primary-300" />
            Map Metadata
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Size (cells)</p>
              <p className="font-bold text-white text-lg">
                {mapWidth} × {mapHeight}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Resolution</p>
              <p className="font-bold text-white text-lg">{mapResolution ? `${mapResolution} m/cell` : 'N/A'}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Origin</p>
              <p className="font-bold text-white text-lg">
                ({(mapData.origin as MapOriginObject)?.x?.toFixed(1) || 0}, {(mapData.origin as MapOriginObject)?.y?.toFixed(1) || 0})
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Last Updated</p>
              <p className="font-bold text-white text-lg">{lastUpdate.toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
