import { useEffect, useState } from 'react';
import { Navigation, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';
import { maps, robots, shelves } from '../services/api';
import { connectWebSocket } from '../services/websocket';

interface MapData {
  id?: string;
  name?: string;
  width: number;
  height: number;
  resolution?: number;
  origin?: number[];
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadMapData();
    loadRobots();
    loadShelves();

    const socket = connectWebSocket();
    if (socket) {
      socket.on('map_update', (data: MapData) => {
        setMapData(data);
        setLastUpdate(new Date());
      });

      socket.on('telemetry', (data: any) => {
        setRobotList((prev) =>
          prev.map((r) =>
            r.robot_id === data.robot
              ? { ...r, x: data.x, y: data.y, status: data.status }
              : r
          )
        );
        setLastUpdate(new Date());
      });
    }

    return () => {
      if (socket) {
        socket.off('map_update');
        socket.off('telemetry');
      }
    };
  }, []);

  const loadMapData = async () => {
    setIsLoading(true);
    try {
      const data = await maps.getMerged();
      setMapData(data);
    } catch (error) {
      console.log('No map data available, using default mock view');
      setMapData({
        name: 'Mock Map',
        width: 20,
        height: 20,
        resolution: 0.05,
        origin: [0, 0, 0],
        data: Array(400).fill(0),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRobots = async () => {
    const data = await robots.list();
    setRobotList(data);
  };

  const loadShelves = async () => {
    const data = await shelves.list();
    setShelfList(data);
  };

  const handleRefresh = () => {
    loadMapData();
    loadRobots();
    loadShelves();
  };

  const getCellColor = (value: number) => {
    // Obstacles (100): Dark red with border effect
    if (value === 100) return '#7f1d1d';
    
    // Free space (0): Light gray/blue navigation area
    if (value === 0) return '#1e293b';
    
    // Unknown (-1 or other): Very dark with slight blue tint
    if (value === -1 || value < 0) return '#0f172a';
    
    // Partial occupancy (1-99): Gradient from free to occupied
    if (value > 0 && value < 100) {
      const intensity = value / 100;
      const r = Math.floor(127 * intensity + 30 * (1 - intensity));
      const g = Math.floor(29 * intensity + 41 * (1 - intensity));
      const b = Math.floor(29 * intensity + 59 * (1 - intensity));
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Default unknown
    return '#0a0e1a';
  };

  const getCellStyle = (value: number) => {
    const baseColor = getCellColor(value);
    
    if (value === 100) {
      // Obstacles: Add pattern/texture effect
      return {
        backgroundColor: baseColor,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.2) 2px, rgba(0,0,0,.2) 4px)',
        boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
      };
    }
    
    if (value === 0) {
      // Free space: Subtle grid pattern
      return {
        backgroundColor: baseColor,
        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      };
    }
    
    // Unknown or partial
    return {
      backgroundColor: baseColor,
    };
  };

  const hasGrid =
    mapData &&
    typeof mapData.width === 'number' &&
    typeof mapData.height === 'number' &&
    Array.isArray(mapData.data) &&
    mapData.data.length === mapData.width * mapData.height;

  const normalizeX = (x: number) => {
    if (hasGrid && mapData) {
      return (x / Math.max(mapData.width - 1, 1)) * 100;
    }
    const minX = Math.min(...shelfList.map((s) => s.x_coord), 0);
    const maxX = Math.max(...shelfList.map((s) => s.x_coord), 10);
    const gridWidth = maxX - minX + 2;
    return ((x - minX) / gridWidth) * 100;
  };

  const normalizeY = (y: number) => {
    if (hasGrid && mapData) {
      return (y / Math.max(mapData.height - 1, 1)) * 100;
    }
    const minY = Math.min(...shelfList.map((s) => s.y_coord), 0);
    const maxY = Math.max(...shelfList.map((s) => s.y_coord), 10);
    const gridHeight = maxY - minY + 2;
    return ((y - minY) / gridHeight) * 100;
  };

  const activeRobots = robotList.filter((r) => r.status !== 'OFFLINE').length;
  const availableShelves = shelfList.filter((s) => s.available).length;
  const occupiedShelves = shelfList.filter((s) => !s.available).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Warehouse Map</h1>
          <p className="text-accent-400">Real-time robot and shelf location tracking</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-primary-500/10 px-4 py-2 rounded-lg border border-primary-500/30">
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-primary-300">Live Tracking</span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 bg-accent-800 hover:bg-accent-700 text-accent-300 hover:text-white rounded-lg transition-all border border-accent-700"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
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
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${showGrid ? 'bg-primary-500 text-white' : 'text-accent-400 hover:text-white'}`}
                title="Toggle grid"
              >
                Grid
              </button>
              <button
                onClick={() => setShowShelves(!showShelves)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${showShelves ? 'bg-green-500 text-white' : 'text-accent-400 hover:text-white'}`}
                title="Toggle shelves"
              >
                Shelves
              </button>
              <button
                onClick={() => setShowRobots(!showRobots)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${showRobots ? 'bg-yellow-500 text-white' : 'text-accent-400 hover:text-white'}`}
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
              <div className="w-6 h-6 rounded border border-accent-600" style={{ 
                backgroundColor: '#1e293b',
                backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
                backgroundSize: '10px 10px'
              }}></div>
              <span className="text-accent-300 font-medium">Free Space</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded border border-accent-600" style={{ 
                backgroundColor: '#7f1d1d',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.2) 2px, rgba(0,0,0,.2) 4px)'
              }}></div>
              <span className="text-accent-300 font-medium">Obstacles</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded border border-accent-600" style={{ backgroundColor: '#0f172a' }}></div>
              <span className="text-accent-300 font-medium">Unknown</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded border border-accent-600" style={{ 
                background: 'linear-gradient(to right, #1e293b, #7f1d1d)'
              }}></div>
              <span className="text-accent-300 font-medium">Partial (1-99%)</span>
            </div>
          </div>

          <div
            className="relative bg-accent-900 rounded-lg border-2 border-accent-700 overflow-hidden shadow-inner"
            style={{
              width: '100%',
              paddingBottom: isFullscreen ? '80%' : '50%',
            }}
          >
            <div className="absolute inset-0 overflow-auto" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-2" />
                    <p className="text-accent-400 text-sm">Loading map data...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Grid */}
                  {showGrid && hasGrid && mapData && (
                    <div
                      className="w-full h-full grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${mapData.width}, 1fr)`,
                        gridTemplateRows: `repeat(${mapData.height}, 1fr)`,
                      }}
                    >
                      {mapData.data.map((cell, idx) => (
                        <div
                          key={idx}
                          style={{
                            ...getCellStyle(cell),
                            width: '100%',
                            height: '100%',
                            transition: 'all 0.3s ease',
                          }}
                          title={`Cell ${idx}: ${cell === 100 ? 'Obstacle' : cell === 0 ? 'Free' : cell < 0 ? 'Unknown' : `${cell}% occupied`}`}
                        />
                      ))}
                    </div>
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
                  {showShelves && shelfList.map((shelf) => (
                    <div
                      key={shelf.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                      style={{
                        left: `${normalizeX(shelf.x_coord)}%`,
                        top: `${normalizeY(shelf.y_coord)}%`,
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
                            <div className="text-accent-300 text-xs">Position: ({shelf.x_coord}, {shelf.y_coord})</div>
                            <div className="text-accent-300 text-xs">Level: {shelf.level}</div>
                            <div className={`text-xs font-medium mt-1 ${shelf.available ? 'text-green-400' : 'text-red-400'}`}>
                              {shelf.available ? 'Available' : 'Occupied'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Robots */}
                  {showRobots && robotList
                    .filter((r) => r.x !== null && r.y !== null && r.x !== undefined && r.y !== undefined)
                    .map((robot) => (
                      <div
                        key={robot.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
                        style={{
                          left: `${normalizeX(robot.x)}%`,
                          top: `${normalizeY(robot.y)}%`,
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
                              <div className="text-white font-bold text-sm mb-1">{robot.name || robot.robot_id}</div>
                              <div className="text-accent-300 text-xs">Position: ({Number(robot.x).toFixed(1)}, {Number(robot.y).toFixed(1)})</div>
                              <div className={`text-xs font-medium mt-1 ${
                                robot.status === 'IDLE' ? 'text-blue-400' :
                                robot.status === 'MOVING' ? 'text-green-400' :
                                robot.status === 'CHARGING' ? 'text-yellow-400' :
                                'text-accent-400'
                              }`}>
                                Status: {robot.status}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
              <p className="font-bold text-white text-lg">{mapData.width} × {mapData.height}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-xs text-accent-400 mb-1 font-medium uppercase tracking-wide">Resolution</p>
              <p className="font-bold text-white text-lg">
                {mapData.resolution ? `${mapData.resolution} m/cell` : 'N/A'}
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