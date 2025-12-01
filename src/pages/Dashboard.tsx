import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Zap, AlertTriangle, Battery } from 'lucide-react';
import { dashboard } from '../services/api';
import { connectWebSocket } from '../services/websocket';

export default function Dashboard() {
  const [systemStats, setSystemStats] = useState<any>(null);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [robotStats, setRobotStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();

    // Refresh stats every 5 seconds
    const interval = setInterval(loadStats, 5000);

    // Connect to WebSocket for real-time updates
    const socket = connectWebSocket();
    if (socket) {
      socket.on('system_update', (data) => {
        setSystemStats(data);
      });
      socket.on('task_update', (data) => {
        setTaskStats((prev: any) => ({
          ...prev,
          ...data,
        }));
      });
      socket.on('robot_update', (data) => {
        setRobotStats((prev: any) => ({
          ...prev,
          ...data,
        }));
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('system_update');
        socket.off('task_update');
        socket.off('robot_update');
      }
    };
  }, []);

  const loadStats = async () => {
    try {
      setError(null);
      const [system, taskLive, robotLive] = await Promise.all([
        dashboard.liveSystem(),
        dashboard.taskStats(),
        dashboard.liveRobots(),
      ]);

      setSystemStats(system);
      setTaskStats(taskLive);
      setRobotStats(robotLive);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load dashboard stats:', err);
      setError(err?.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-accent-400">Loading dashboard...</div>
      </div>
    );
  }

  const health = systemStats?.health || {};
  const tasks = systemStats?.tasks || taskStats || {};
  const robots = systemStats?.robots || robotStats?.summary || {};
  const resources = systemStats?.resources || {};

  const healthColor = health.status === 'HEALTHY' ? 'text-green-400' : health.status === 'WARNING' ? 'text-yellow-400' : 'text-red-400';
  const healthBg = health.status === 'HEALTHY' ? 'bg-green-500/10' : health.status === 'WARNING' ? 'bg-yellow-500/10' : 'bg-red-500/10';
  const healthBorder = health.status === 'HEALTHY' ? 'border-green-500/30' : health.status === 'WARNING' ? 'border-yellow-500/30' : 'border-red-500/30';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">System Dashboard</h1>
        <p className="text-accent-400">Real-time warehouse automation metrics</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-100">{error}</p>
            <button
              onClick={loadStats}
              className="mt-2 text-xs text-red-300 hover:text-red-200 font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* System Health Card */}
      <div className={`rounded-xl border p-8 ${healthBg} ${healthBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">System Health</h2>
          <div className={`text-4xl font-bold ${healthColor}`}>{health.score || 0}%</div>
        </div>
        <p className={`text-sm ${healthColor} font-semibold mb-4`}>{health.status || 'UNKNOWN'}</p>
        <p className="text-sm text-accent-300">Average Robot Battery: {health.avg_battery || 0}%</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tasks */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Total Tasks</h3>
            <Activity className="w-5 h-5 text-primary-400" />
          </div>
          <p className="text-3xl font-bold text-white">{tasks.total || 0}</p>
          <p className="text-xs text-accent-500 mt-2">All tasks created</p>
        </div>

        {/* In Progress */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">In Progress</h3>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-300">{tasks.in_progress || 0}</p>
          <p className="text-xs text-accent-500 mt-2">Currently running</p>
        </div>

        {/* Completed */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Completed</h3>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-300">{tasks.completed || 0}</p>
          <p className="text-xs text-accent-500 mt-2">Successfully finished</p>
        </div>

        {/* Failed */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Failed</h3>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-300">{tasks.failed || 0}</p>
          <p className="text-xs text-accent-500 mt-2">Errors encountered</p>
        </div>
      </div>

      {/* Robots Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Total Robots</h3>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{robots.total || 0}</p>
        </div>

        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Available</h3>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-300">{robots.available || 0}</p>
        </div>

        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Busy</h3>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-300">{robots.busy || 0}</p>
        </div>

        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-accent-400">Offline</h3>
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-300">{robots.offline || 0}</p>
        </div>
      </div>

      {/* Task Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Task Performance</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-accent-400">Success Rate</span>
                <span className="text-sm font-bold text-green-300">{tasks.success_rate || 0}%</span>
              </div>
              <div className="w-full bg-accent-800 rounded h-2">
                <div
                  className="bg-green-500 h-2 rounded transition-all duration-300"
                  style={{ width: `${tasks.success_rate || 0}%` }}
                />
              </div>
            </div>
            <div className="pt-2 text-xs text-accent-500">
              Avg Duration: {tasks.avg_duration_seconds || 0}s
            </div>
          </div>
        </div>

        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Resources</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-accent-400">Total Shelves</span>
              <span className="font-bold text-white">{resources.total_shelves || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-accent-400">In Use</span>
              <span className="font-bold text-yellow-300">{resources.shelves_in_use || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-accent-400">Total Zones</span>
              <span className="font-bold text-white">{resources.total_zones || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Robot Details */}
      {robotStats?.robots && robotStats.robots.length > 0 && (
        <div className="bg-gradient-card rounded-xl border border-accent-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Robot Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {robotStats.robots.map((robot: any) => (
              <div key={robot.id} className="bg-accent-800/50 rounded-lg p-4 border border-accent-700/50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-white">{robot.name}</p>
                    <p className="text-xs text-accent-500">{robot.robot_id}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      robot.status === 'IDLE'
                        ? 'bg-green-500/20 text-green-300'
                        : robot.status === 'BUSY'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {robot.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  {robot.battery_level !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-accent-400">Battery</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-12 bg-accent-700 rounded h-1.5">
                          <div
                            className={`h-1.5 rounded transition-all ${
                              robot.battery_level > 50 ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${robot.battery_level}%` }}
                          />
                        </div>
                        <span className="text-white font-semibold w-8">{robot.battery_level}%</span>
                      </div>
                    </div>
                  )}
                  {robot.cpu_usage !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-accent-400">CPU</span>
                      <span className="text-white">{Number(robot.cpu_usage).toFixed(1)}%</span>
                    </div>
                  )}
                  {robot.ram_usage !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-accent-400">RAM</span>
                      <span className="text-white">{Number(robot.ram_usage).toFixed(1)}%</span>
                    </div>
                  )}
                  {robot.temperature !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-accent-400">Temp</span>
                      <span className="text-white">{Number(robot.temperature).toFixed(1)}°C</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh indicator */}
      <div className="text-xs text-accent-500 text-center">
        Last updated: {systemStats?.timestamp ? new Date(systemStats.timestamp).toLocaleTimeString() : '—'}
      </div>
    </div>
  );
}
