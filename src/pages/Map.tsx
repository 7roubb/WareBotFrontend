import { useEffect, useState } from 'react';
import { Map as MapIcon, Navigation } from 'lucide-react';
import { maps, robots, shelves } from '../services/api';
import { connectWebSocket } from '../services/websocket';

export default function Map() {
  const [mapData, setMapData] = useState<any>(null);
  const [robotList, setRobotList] = useState<any[]>([]);
  const [shelfList, setShelfList] = useState<any[]>([]);

  useEffect(() => {
    loadMapData();
    loadRobots();
    loadShelves();

    const socket = connectWebSocket();
    if (socket) {
      socket.on('map_update', (data) => {
        setMapData(data);
      });

      socket.on('telemetry', (data) => {
        setRobotList((prev) =>
          prev.map((r) =>
            r.robot_id === data.robot
              ? { ...r, x: data.x, y: data.y, status: data.status }
              : r
          )
        );
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
    try {
      const data = await maps.getMerged();
      setMapData(data);
    } catch (error) {
      console.log('No map data available');
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

  const minX = Math.min(...shelfList.map((s) => s.x_coord), 0);
  const maxX = Math.max(...shelfList.map((s) => s.x_coord), 10);
  const minY = Math.min(...shelfList.map((s) => s.y_coord), 0);
  const maxY = Math.max(...shelfList.map((s) => s.y_coord), 10);

  const gridWidth = maxX - minX + 2;
  const gridHeight = maxY - minY + 2;

  const normalizeX = (x: number) => ((x - minX) / gridWidth) * 100;
  const normalizeY = (y: number) => ((y - minY) / gridHeight) * 100;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Warehouse Map</h1>
          <p className="text-accent-400">Real-time robot and shelf location tracking</p>
        </div>
        <div className="flex items-center space-x-2 text-primary-300">
          <Navigation className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">Live Tracking</span>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="bg-gradient-card rounded-xl shadow-neo p-4 border border-accent-700">
        <div
          className="relative bg-accent-900 rounded-lg border-2 border-accent-700"
          style={{
            width: '100%',
            paddingBottom: '50%',
          }}
        >
          <div className="absolute inset-0">
            {/* Shelves */}
            {shelfList.map((shelf) => (
              <div
                key={shelf.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${normalizeX(shelf.x_coord)}%`,
                  top: `${normalizeY(shelf.y_coord)}%`,
                }}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-neo transition-all group relative ${
                    shelf.available
                      ? 'bg-primary-500 hover:bg-primary-400'
                      : 'bg-red-500 hover:bg-red-400'
                  }`}
                >
                  <div className="w-2 h-2 bg-white rounded-sm" />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-accent-900 border border-accent-700 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-10 shadow-neo">
                    <div className="font-bold text-primary-300 text-xs">({shelf.x_coord}, {shelf.y_coord})</div>
                    <div className="text-accent-300 text-xs">L{shelf.level}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Robots */}
            {robotList
              .filter((r) => r.x !== null && r.y !== null)
              .map((robot) => (
                <div
                  key={robot.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
                  style={{
                    left: `${normalizeX(robot.x)}%`,
                    top: `${normalizeY(robot.y)}%`,
                  }}
                >
                  <div className="relative group">
                    <div className="w-8 h-8 bg-gradient-yellow rounded-full flex items-center justify-center shadow-neo animate-pulse border-3 border-accent-900">
                      <Navigation className="w-4 h-4 text-accent-900 font-bold" />
                    </div>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-accent-900 border border-accent-700 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-10 shadow-neo">
                      <div className="font-bold text-primary-300 text-xs">{robot.name}</div>
                      <div className="text-accent-300 text-xs">
                        ({robot.x.toFixed(1)}, {robot.y.toFixed(1)})
                      </div>
                      <div className="text-accent-400 text-xs">{robot.status}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/20">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-primary-500 rounded-lg"></div>
              <div>
                <p className="text-sm text-accent-400">Available Shelves</p>
                <p className="text-xl font-bold text-primary-300">
                  {shelfList.filter((s) => s.available).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-red-500 rounded-lg"></div>
              <div>
                <p className="text-sm text-accent-400">Occupied Shelves</p>
                <p className="text-xl font-bold text-red-300">
                  {shelfList.filter((s) => !s.available).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/20">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-gradient-yellow rounded-full"></div>
              <div>
                <p className="text-sm text-accent-400">Active Robots</p>
                <p className="text-xl font-bold text-primary-300">
                  {robotList.filter((r) => r.status !== 'OFFLINE').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mapData && (
        <div className="bg-gradient-card rounded-xl shadow-neo p-6 border border-accent-700">
          <h2 className="text-xl font-bold mb-4 flex items-center text-white">
            <MapIcon className="w-5 h-5 mr-2 text-primary-300" />
            Map Metadata
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-sm text-accent-400">Map Name</p>
              <p className="font-semibold text-white mt-1">{mapData.name || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
              <p className="text-sm text-accent-400">Last Updated</p>
              <p className="font-semibold text-white mt-1">
                {mapData.updated_at
                  ? new Date(mapData.updated_at).toLocaleString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
