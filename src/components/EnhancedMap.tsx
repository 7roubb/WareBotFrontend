/**
 * Enhanced Map Component with Real-Time Task Integration
 * Displays warehouse map with live robot positions, shelves, and task status
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { maps, robots, shelves } from '../services/api';
import { useMapView } from '../hooks/useRealTimeTasks';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export const EnhancedMap: React.FC = () => {
  const [mapData, setMapData] = useState<MapData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [robotList, setRobotList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showShelves, setShowShelves] = useState(true);
  const [showRobots, setShowRobots] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mapError, setMapError] = useState<string | null>(null);

  // Real-time task updates
  const { tasks, wsConnected } = useMapView();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Color function for map cells
  const getCellColorRGB = (value: number): [number, number, number] => {
    if (value === 100) return [127, 29, 29]; // Obstacles: red
    if (value === 0) return [30, 41, 59]; // Free space: dark
    if (value === -1 || value < 0) return [15, 23, 42]; // Unknown: darker
    if (value > 0 && value < 100) {
      const intensity = value / 100;
      const r = Math.floor(127 * intensity + 30 * (1 - intensity));
      const g = Math.floor(29 * intensity + 41 * (1 - intensity));
      const b = Math.floor(29 * intensity + 59 * (1 - intensity));
      return [r, g, b];
    }
    return [10, 14, 26];
  };

  // World coordinates to percentage conversion
  const worldToPercent = useCallback(
    (x: number, y: number): { left: number; top: number } => {
      if (!hasGrid || !mapData) {
        const xs = shelfList.map((s) => Number(s.x_coord ?? 0));
        const ys = shelfList.map((s) => Number(s.y_coord ?? 0));
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
    [hasGrid, mapData, mapWidth, mapHeight, mapResolution, shelfList]
  );

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setMapError(null);
    try {
      const [mapRes, robotRes, shelfRes] = await Promise.all([maps.getMerged(), robots.list(), shelves.list()]);

      if (mapRes) {
        setMapData(mapRes);
      } else {
        setMapData({
          name: 'Default Map',
          width: 20,
          height: 20,
          resolution: 0.05,
          origin: { x: 0, y: 0, yaw: 0 },
          data: Array(20 * 20).fill(0),
        });
      }

      const normalizedRobots = (robotRes || []).map((r: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const robot = r as any;
        return {
          ...robot,
          x: robot.x !== undefined && robot.x !== null ? Number(robot.x) : null,
          y: robot.y !== undefined && robot.y !== null ? Number(robot.y) : null,
          id: robot.id ?? robot.robot_id ?? `robot-${Math.random().toString(36).slice(2, 8)}`,
        };
      });
      setRobotList(normalizedRobots);

      const normalizedShelves = (shelfRes || []).map((s: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shelf = s as any;
        return {
          ...shelf,
          x_coord: Number(shelf.x_coord ?? 0),
          y_coord: Number(shelf.y_coord ?? 0),
          id: shelf.id ?? `shelf-${Math.random().toString(36).slice(2, 8)}`,
        };
      });
      setShelfList(normalizedShelves);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[EnhancedMap] Failed to load data:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to load map data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh shelves only
  const refreshShelves = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const shelfRes = await shelves.list();
      const normalizedShelves = (shelfRes || []).map((s: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shelf = s as any;
        return {
          ...shelf,
          x_coord: Number(shelf.x_coord ?? 0),
          y_coord: Number(shelf.y_coord ?? 0),
          id: shelf.id ?? `shelf-${Math.random().toString(36).slice(2, 8)}`,
        };
      });
      setShelfList(normalizedShelves);
      setLastUpdate(new Date());
      console.log('[EnhancedMap] Shelves refreshed:', normalizedShelves.length);
    } catch (error) {
      console.error('[EnhancedMap] Failed to refresh shelves:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Canvas rendering
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current || !mapData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid if enabled
    if (showGrid && hasGrid && mapData.data) {
      const imageData = ctx.createImageData(mapWidth, mapHeight);
      const data = imageData.data;

      for (let i = 0; i < mapData.data.length; i++) {
        const value = mapData.data[i];
        const [r, g, b] = getCellColorRGB(value);
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      ctx.drawImage(canvas, 0, 0, mapWidth, mapHeight, 0, 0, width, height);
    }

    // Draw shelves
    if (showShelves && shelfList.length > 0) {
      shelfList.forEach((shelf) => {
        const pos = worldToPercent(shelf.x_coord, shelf.y_coord);
        const x = (pos.left / 100) * width;
        const y = (pos.top / 100) * height;

        // Shelf circle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Shelf ID label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(shelf.shelf_id?.slice(0, 3) || 'S', x, y + 4);
      });
    }

    // Draw robots
    if (showRobots && robotList.length > 0) {
      robotList.forEach((robot) => {
        if (robot.x === null || robot.y === null) return;

        const pos = worldToPercent(robot.x, robot.y);
        const x = (pos.left / 100) * width;
        const y = (pos.top / 100) * height;

        // Robot square
        ctx.fillStyle = robot.status === 'OFFLINE' ? '#ef4444' : '#10b981';
        ctx.fillRect(x - 6, y - 6, 12, 12);

        // Robot ID label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(robot.robot_id?.slice(0, 1) || 'R', x, y + 3);
      });
    }

    // Draw task robots and shelves from real-time data
    if (showTasks && tasks.length > 0) {
      tasks.forEach((task) => {
        // Task robot position
        const robotPos = worldToPercent(task.robot.x, task.robot.y);
        const rx = (robotPos.left / 100) * width;
        const ry = (robotPos.top / 100) * height;

        // Draw task robot as triangle
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(rx, ry - 8);
        ctx.lineTo(rx + 8, ry + 8);
        ctx.lineTo(rx - 8, ry + 8);
        ctx.closePath();
        ctx.fill();

        // Task shelf position
        const shelfPos = worldToPercent(task.shelf.x, task.shelf.y);
        const sx = (shelfPos.left / 100) * width;
        const sy = (shelfPos.top / 100) * height;

        // Draw target shelf
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Connection line
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }, [mapData, showGrid, showShelves, showRobots, showTasks, hasGrid, mapWidth, mapHeight, shelfList, robotList, tasks, worldToPercent, getCellColorRGB]);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Redraw on every update
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Animation loop for smooth updates
  useEffect(() => {
    const animateCanvas = () => {
      redrawCanvas();
      animationFrameRef.current = requestAnimationFrame(animateCanvas);
    };

    animationFrameRef.current = requestAnimationFrame(animateCanvas);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [redrawCanvas]);

  // Auto-refresh shelves periodically
  useEffect(() => {
    const interval = setInterval(refreshShelves, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [refreshShelves]);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
          <p className="text-white">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-screen'} bg-gray-900 flex flex-col`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white text-xl font-bold">Warehouse Map</h1>
            <p className="text-gray-400 text-sm">
              Last updated: {lastUpdate.toLocaleTimeString()} {wsConnected && <span className="text-green-400">• Live</span>}
            </p>
          </div>

          {mapError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              {mapError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={refreshShelves}
              disabled={isRefreshing}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Canvas area */}
        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full"
            style={{ transform: `scale(${zoom})` }}
          />

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-gray-800 rounded-lg p-2 border border-gray-700">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
              className="p-2 hover:bg-gray-700 text-white rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="text-white text-xs text-center">{(zoom * 100).toFixed(0)}%</div>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
              className="p-2 hover:bg-gray-700 text-white rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-2 hover:bg-gray-700 text-white rounded text-xs font-bold"
            >
              Reset
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 bg-gray-800 rounded-lg p-3 border border-gray-700 text-white text-sm space-y-2">
            <div className="font-bold mb-2">Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Shelves</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500"></div>
              <span>Robots</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rotate-45"></div>
              <span>Active Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600"></div>
              <span>Obstacles</span>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-bold mb-2">Display Options</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show Grid
                </label>
                <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showShelves}
                    onChange={(e) => setShowShelves(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show Shelves ({shelfList.length})
                </label>
                <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRobots}
                    onChange={(e) => setShowRobots(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show Robots ({robotList.length})
                </label>
                <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTasks}
                    onChange={(e) => setShowTasks(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show Tasks ({tasks.length})
                </label>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-2">Active Tasks</h3>
              {tasks.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {tasks.map((task) => (
                    <div key={task.task_id} className="bg-gray-700 rounded p-2 text-sm text-gray-300">
                      <p className="font-mono text-xs text-gray-400">{task.task_id.slice(0, 8)}</p>
                      <p className="text-xs">{task.status}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No active tasks</p>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-2">WebSocket Status</h3>
              <div className={`text-sm ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                {wsConnected ? '● Connected' : '● Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMap;
