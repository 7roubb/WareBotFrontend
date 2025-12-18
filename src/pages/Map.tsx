import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Navigation, Maximize2, Minimize2, ZoomIn, ZoomOut, Layers, RotateCw } from 'lucide-react';
import { maps, robots, shelves } from '../services/api';
import { connectWebSocket } from '../services/websocket';

interface MapOriginObject {
  x: number;
  y: number;
  yaw?: number;
}

type MapOrigin = MapOriginObject | [number, number, number?];

interface MapData {
  id?: string;
  name?: string;
  width: number;
  height: number;
  resolution?: number;
  origin?: MapOrigin;
  data: number[];
  updated_at?: string;
  [key: string]: any;
}

export default function Map() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [robotList, setRobotList] = useState<any[]>([]);
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showShelves, setShowShelves] = useState(true);
  const [showRobots, setShowRobots] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Safe numeric getters
  const mapWidth = useMemo(() => (mapData ? Number(mapData.width || 0) : 0), [mapData]);
  const mapHeight = useMemo(() => (mapData ? Number(mapData.height || 0) : 0), [mapData]);
  const mapResolution = useMemo(() => (mapData ? Number(mapData.resolution ?? 0.05) : 0.05), [mapData]);

  const hasGrid =
    !!mapData &&
    Number.isFinite(mapWidth) &&
    Number.isFinite(mapHeight) &&
    Array.isArray(mapData.data) &&
    mapData.data.length === mapWidth * mapHeight &&
    mapWidth > 0 &&
    mapHeight > 0;

  // Lightweight color function (same semantics as your old getCellColor)
  const getCellColorRGB = (value: number): [number, number, number] => {
    // Obstacles (100): #7f1d1d
    if (value === 100) return [127, 29, 29];

    // Free space (0): #1e293b
    if (value === 0) return [30, 41, 59];

    // Unknown (-1 or other negative): #0f172a
    if (value === -1 || value < 0) return [15, 23, 42];

    // Partial occupancy (1-99): gradient between free and obstacle
    if (value > 0 && value < 100) {
      const intensity = value / 100;
      const r = Math.floor(127 * intensity + 30 * (1 - intensity));
      const g = Math.floor(29 * intensity + 41 * (1 - intensity));
      const b = Math.floor(29 * intensity + 59 * (1 - intensity));
      return [r, g, b];
    }

    // Default unknown: #0a0e1a
    return [10, 14, 26];
  };

  // Convert world coordinates (meters) -> percentage inside the map container.
  // Uses map origin, resolution, and flips Y to match canvas drawing.
  const worldToPercent = (x: number, y: number): { left: number; top: number } => {
    // Fallback: if no grid, compute extents from shelves (keeps the old behaviour)
    if (!hasGrid || !mapData) {
      const xs = shelfList.map((s) => Number(s.x_coord ?? 0));
      const ys = shelfList.map((s) => Number(s.y_coord ?? 0));

      const minX = xs.length ? Math.min(...xs, 0) : 0;
      const maxX = xs.length ? Math.max(...xs, 10) : 10;
      const minY = ys.length ? Math.min(...ys, 0) : 0;
      const maxY = ys.length ? Math.max(...ys, 10) : 10;

      const gridWidth = maxX - minX || 1;
      const gridHeight = maxY - minY || 1;

      const left = ((x - minX) / gridWidth) * 100;
      const top = ((1 - (y - minY) / gridHeight) * 100); // flip Y to match canvas top=0

      return {
        left: Math.max(0, Math.min(100, left)),
        top: Math.max(0, Math.min(100, top)),
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

    // world (meters) -> cell indices
    const cellX = (x - originX) / mapResolution;
    const cellY = (y - originY) / mapResolution;

    const left = (cellX / Math.max(mapWidth, 1)) * 100;
    // Flip Y: in map coordinates row 0 is bottom; in CSS top=0 is top
    const top = (1 - cellY / Math.max(mapHeight, 1)) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      top: Math.max(0, Math.min(100, top)),
    };
  };

  // Loaders
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [mapRes, robotRes, shelfRes] = await Promise.all([
        maps.getMerged(),
        robots.list(),
        shelves.list(),
      ]);

      if (mapRes) {
        setMapData(mapRes);
      } else {
        setMapData({
          name: 'Mock Map',
          width: 20,
          height: 20,
          resolution: 0.05,
          origin: { x: 0, y: 0, yaw: 0 },
          data: Array(20 * 20).fill(0),
        });
      }

      const normalizedRobots = (robotRes || []).map((r: any) => ({
        ...r,
        x: r.x !== undefined && r.x !== null ? Number(r.x) : null,
        y: r.y !== undefined && r.y !== null ? Number(r.y) : null,
        _x: r.x !== undefined && r.x !== null ? Number(r.x) : null,
        _y: r.y !== undefined && r.y !== null ? Number(r.y) : null,
        id: r.id ?? r.robot_id ?? `${r.name ?? 'robot'}-${Math.random().toString(36).slice(2, 8)}`,
      }));
      setRobotList(normalizedRobots);

      const normalizedShelves = (shelfRes || []).map((s: any) => ({
        ...s,
        x_coord: Number(s.x_coord ?? 0),
        y_coord: Number(s.y_coord ?? 0),
        id: s.id ?? `${Math.random().toString(36).slice(2, 8)}`,
      }));
      setShelfList(normalizedShelves);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh shelf locations only
  const loadShelves = async () => {
    setIsRefreshing(true);
    try {
      const shelfRes = await shelves.list();
      const normalizedShelves = (shelfRes || []).map((s: any) => ({
        ...s,
        x_coord: Number(s.x_coord ?? 0),
        y_coord: Number(s.y_coord ?? 0),
        id: s.id ?? `${Math.random().toString(36).slice(2, 8)}`,
      }));
      setShelfList(normalizedShelves);
      setLastUpdate(new Date());
      console.log('[MAP] Shelves refreshed:', normalizedShelves.length);
    } catch (error) {
      console.error('Failed to refresh shelves:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper function to process telemetry events - simple pattern matching Robots.tsx
  const handleTelemetryEvent = useCallback((data: any) => {
    setRobotList((prev) =>
      prev.map((r) =>
        r.robot_id === data.robot || r.id === data.robot || String(r.id) === String(data.robot)
          ? {
              ...r,
              cpu_usage: data.cpu,
              ram_usage: data.ram,
              battery_level: data.battery,
              temperature: data.temperature,
              x: data.x,
              y: data.y,
              _x: data.x,
              _y: data.y,
              status: data.status,
            }
          : r,
      ),
    );
    setLastUpdate(new Date());
  }, []);

  // Initialize WebSocket connection and load initial data
  useEffect(() => {
    // Load initial data once on mount
    loadInitialData();

    // Connect to WebSocket and set up event listeners
    const socket = connectWebSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('[WS] Connected');
    };

    const handleDisconnect = () => {
      console.log('[WS] Disconnected');
    };

    const handleMapUpdate = (data: any) => {
      if (data) {
        setMapData(data);
        setLastUpdate(new Date());
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('telemetry', handleTelemetryEvent);
    socket.on('map_update', handleMapUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('telemetry', handleTelemetryEvent);
      socket.off('map_update', handleMapUpdate);
    };
  }, [handleTelemetryEvent]);



  // Establish websocket and listeners
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Fallback: if websocket is disconnected, try to reconnect
      const connected = !!(socketRef.current && (socketRef.current.connected || socketRef.current.connected === true));
      if (!connected) {
        console.log('[WS] Disconnected, will auto-reconnect via socket.io-client');
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) {
        try {
          if (socketRef.current.off) {
            socketRef.current.off('map_update');
            socketRef.current.off('telemetry');
            socketRef.current.off('robot_update');
            socketRef.current.off('robot_telemetry');
            socketRef.current.off('position_update');
            socketRef.current.off('connect');
            socketRef.current.off('disconnect');
            socketRef.current.off('error');
            socketRef.current.off('task_status');
            socketRef.current.off('robot_custom');
          }
        } catch (e) {
          // ignore
        }
        socketRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Background refresh: update robot positions every 0.5 seconds
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        const updatedRobots = await robots.list();
        setRobotList((prev) =>
          prev.map((robot) => {
            const found = updatedRobots.find(
              (r: any) => r.id === robot.id || r.robot_id === robot.robot_id
            );
            if (found) {
              return {
                ...robot,
                x: found.x !== undefined && found.x !== null ? Number(found.x) : robot.x,
                y: found.y !== undefined && found.y !== null ? Number(found.y) : robot.y,
                _x: found.x !== undefined && found.x !== null ? Number(found.x) : robot._x,
                _y: found.y !== undefined && found.y !== null ? Number(found.y) : robot._y,
                status: found.status ?? robot.status,
                battery_level: found.battery_level ?? robot.battery_level,
                temperature: found.temperature ?? robot.temperature,
                cpu_usage: found.cpu_usage ?? robot.cpu_usage,
                ram_usage: found.ram_usage ?? robot.ram_usage,
              };
            }
            return robot;
          }),
        );
        setLastUpdate(new Date());
      } catch (error) {
        console.error('[MAP] Background refresh error:', error);
      }
    }, 50); // Refresh every 0.5 seconds (500ms)

    return () => clearInterval(refreshInterval);
  }, []);

  // Smooth animation loop: interpolate displayed coordinates (_x/_y) toward target (x/y)
  useEffect(() => {
    let raf: number | null = null;

    const animate = () => {
      setRobotList((prev) => {
        let changed = false;
        const next = prev.map((r) => {
          const targetX = r.x;
          const targetY = r.y;

          // If either coordinate missing, do nothing
          if (targetX === null || targetX === undefined || targetY === null || targetY === undefined) {
            return r;
          }

          const curX = r._x !== undefined && r._x !== null ? Number(r._x) : Number(targetX);
          const curY = r._y !== undefined && r._y !== null ? Number(r._y) : Number(targetY);

          const dx = Number(targetX) - curX;
          const dy = Number(targetY) - curY;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.005) {
            // close enough: snap to target
            if (curX === Number(targetX) && curY === Number(targetY)) return r;
            changed = true;
            return { ...r, _x: Number(targetX), _y: Number(targetY) };
          }

          // Interpolate (lerp) towards target. alpha controls smoothness (0-1)
          const alpha = 0.18;
          const nx = curX + dx * alpha;
          const ny = curY + dy * alpha;
          changed = true;
          return { ...r, _x: nx, _y: ny };
        });

        // If nothing changed, return previous array to avoid unnecessary re-renders
        if (!changed) return prev;
        return next;
      });

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
    // Intentionally empty deps: keep animation running while component mounted.
  }, []);

  // Draw the occupancy grid to the canvas. We draw one pixel per cell and rely on CSS scaling (imageRendering: 'pixelated')
  useEffect(() => {
    if (!mapData || !hasGrid || !showGrid) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = mapWidth;
    const height = mapHeight;
    const data = mapData.data;

    // Set internal canvas pixel size to map cells
    canvas.width = width;
    canvas.height = height;

    // Ensure the canvas scales to container
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // For crisp pixelated look
    ctx.imageSmoothingEnabled = false;

    // Create ImageData and populate
    const imageData = ctx.createImageData(width, height);
    const buf = imageData.data;

    // Map data index convention: row 0 = bottom. We flip Y so map row 0 appears at bottom visually.
    for (let i = 0; i < data.length; i++) {
      const val = Number(data[i]);
      const col = i % width;
      const row = Math.floor(i / width);

      const canvasRow = height - 1 - row; // flip
      const offset = (canvasRow * width + col) * 4;

      const [r, g, b] = getCellColorRGB(val);
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
      buf[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [mapData, hasGrid, showGrid, mapWidth, mapHeight]);

  const activeRobots = robotList.filter((r) => (r.status ?? '').toUpperCase() !== 'OFFLINE').length;
  const availableShelves = shelfList.filter((s) => s.available).length;
  const occupiedShelves = shelfList.filter((s) => !s.available).length;

  // Compute paddingBottom percent for correct aspect ratio (height/width * 100)
  // MINIMIZED: Cap the map height to prevent stretching
  const aspectRatio = hasGrid ? (mapHeight / Math.max(mapWidth, 1)) : 1;
  const cappedAspectRatio = Math.min(aspectRatio, 0.75); // Cap at 75% max height
  const aspectPadding = `${cappedAspectRatio * 100}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map</h1>
          <p className="text-accent-400">Real-time robot and shelf location tracking</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-4xl font-bold text-white">{occupiedShelves}</p>
            </div>
            <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center">
              <div className="w-7 h-7 bg-red-400 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

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

            {/* Refresh Shelves */}
            <button
              onClick={loadShelves}
              disabled={isRefreshing}
              className={`p-2 bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white rounded-lg transition-all border border-accent-700 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh shelf locations"
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
          <div className="mb-4 flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded border border-accent-600"
                style={{
                  backgroundColor: '#1e293b',
                  backgroundImage:
                    'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                }}
              ></div>
              <span className="text-accent-300 font-medium">Free Space</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded border border-accent-600"
                style={{
                  backgroundColor: '#7f1d1d',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.2) 2px, rgba(0,0,0,.2) 4px)',
                }}
              ></div>
              <span className="text-accent-300 font-medium">Obstacles</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded border border-accent-600" style={{ backgroundColor: '#0f172a' }}></div>
              <span className="text-accent-300 font-medium">Unknown</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded border border-accent-600"
                style={{
                  background: 'linear-gradient(to right, #1e293b, #7f1d1d)',
                }}
              ></div>
              <span className="text-accent-300 font-medium">Partial (1-99%)</span>
            </div>
          </div>

          <div
            className="relative bg-accent-900 rounded-lg border-2 border-accent-700 overflow-hidden shadow-inner"
            style={{
              width: '100%',
              paddingBottom: aspectPadding,
            }}
          >
            <div
              className="absolute inset-0 overflow-auto"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
              }}
            >
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-primary-400/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-accent-400 text-sm">Loading map data...</p>
                  </div>
                </div>
              ) : (
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

                  {!hasGrid && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Layers className="w-12 h-12 text-accent-500 mx-auto mb-3" />
                        <p className="text-accent-400 text-sm font-medium">No map grid available</p>
                        <p className="text-accent-500 text-xs mt-1">Waiting for /warehouse/map 🛰️</p>
                      </div>
                    </div>
                  )}

                  {/* Shelves */}
                  {showShelves &&
                    shelfList.map((shelf) => {
                      const { left, top } = worldToPercent(Number(shelf.x_coord), Number(shelf.y_coord));
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
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all transform hover:scale-110 cursor-pointer ${
                                shelf.available
                                  ? 'bg-gradient-to-br from-green-400 to-green-600 hover:from-green-300 hover:to-green-500'
                                  : 'bg-gradient-to-br from-red-400 to-red-600 hover:from-red-300 hover:to-red-500'
                              }`}
                            >
                              <div className="w-3 h-3 bg-white rounded-sm opacity-90" />
                            </div>
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20">
                              <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                <div className="text-white font-bold text-sm mb-1">Shelf #{shelf.id}</div>
                                <div className="text-accent-300 text-xs">
                                  Position: ({shelf.x_coord}, {shelf.y_coord})
                                </div>
                                <div className="text-accent-300 text-xs">Level: {shelf.level}</div>
                                <div
                                  className={`text-xs font-medium mt-1 ${
                                    shelf.available ? 'text-green-400' : 'text-red-400'
                                  }`}
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
                    robotList
                      .filter((r) => r.x !== null && r.y !== null && r.x !== undefined && r.y !== undefined)
                      .map((robot) => {
                        // Use _x/_y (displayed coordinates) so movement is smooth via animation loop
                        const dispX = robot._x !== undefined && robot._x !== null ? Number(robot._x) : Number(robot.x);
                        const dispY = robot._y !== undefined && robot._y !== null ? Number(robot._y) : Number(robot.y);
                        const { left, top } = worldToPercent(dispX, dispY);
                        const key = robot.id ?? robot.robot_id ?? `${robot.name}-${left}-${top}`;
                        return (
                          <div
                            key={key}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              // We rely on state-updates for smooth movement; keep a short transition as fallback
                              transition: 'all 0.12s linear',
                            }}
                          >
                            <div className="group relative">
                              <div className="relative">
                                <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-50 animate-pulse"></div>
                                <div className="relative w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center shadow-xl border-4 border-accent-900 transform hover:scale-110 transition-transform cursor-pointer">
                                  <Navigation className="w-5 h-5 text-accent-900 font-bold" />
                                </div>
                              </div>
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20">
                                <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                  <div className="text-white font-bold text-sm mb-1">
                                    {robot.name || robot.robot_id}
                                  </div>
                                  <div className="text-accent-300 text-xs">
                                    Position: ({Number(dispX).toFixed(1)}, {Number(dispY).toFixed(1)})
                                  </div>
                                  <div
                                    className={`text-xs font-medium mt-1 ${
                                      (robot.status ?? '').toUpperCase() === 'IDLE'
                                        ? 'text-blue-400'
                                        : (robot.status ?? '').toUpperCase() === 'MOVING'
                                        ? 'text-green-400'
                                        : (robot.status ?? '').toUpperCase() === 'CHARGING'
                                        ? 'text-yellow-400'
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
                </>
              )}
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
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Map Name</p>
              <p className="font-bold text-white text-lg">{mapData.name || 'Merged Map'}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Size (cells)</p>
              <p className="font-bold text-white text-lg">
                {mapWidth} × {mapHeight}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Resolution</p>
              <p className="font-bold text-white text-lg">
                {mapResolution ? `${mapResolution} m/cell` : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Last Updated</p>
              <p className="font-bold text-white text-lg">
                {mapData.updated_at ? new Date(mapData.updated_at).toLocaleString() : 'Live'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}