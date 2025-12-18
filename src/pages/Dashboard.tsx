import { useEffect, useState } from 'react';
import { Activity, Zap, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { dashboard } from '../services/api';
import {
  subscribeToTasksRoom,
  subscribeToRobotsRoom,
  subscribeToSystemRoom,
  unsubscribeFromAll,
  connectWebSocket,
} from '../services/websocket';

interface TaskStats {
  total_tasks: number;
  assigned_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  completion_rate: number;
  success_rate: number;
}

interface RobotStats {
  total_robots: number;
  available_robots: number;
  busy_robots: number;
  offline_robots: number;
  average_battery_level: number;
  average_temperature: number;
}

interface SystemHealth {
  health_score: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  average_battery_level: number;
  active_tasks_count: number;
  timestamp?: string;
}

export default function Dashboard() {
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total_tasks: 0,
    assigned_tasks: 0,
    in_progress_tasks: 0,
    completed_tasks: 0,
    failed_tasks: 0,
    completion_rate: 0,
    success_rate: 0,
  });

  const [robotStats, setRobotStats] = useState<RobotStats>({
    total_robots: 0,
    available_robots: 0,
    busy_robots: 0,
    offline_robots: 0,
    average_battery_level: 0,
    average_temperature: 0,
  });

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    health_score: 0,
    status: 'HEALTHY',
    average_battery_level: 0,
    active_tasks_count: 0,
  });

  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [tasks, robots, system] = await Promise.all([
          dashboard.liveTasks(),
          dashboard.liveRobots(),
          dashboard.liveSystem(),
        ]);

        if (tasks) setTaskStats(tasks);
        if (robots) setRobotStats(robots);
        if (system) setSystemHealth(system);

        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setError(err?.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Connect WebSocket and subscribe to rooms
    const socket = connectWebSocket();

    // Subscribe to tasks room for real-time task updates
    const unsubscribeTasks = subscribeToTasksRoom((data: any) => {
      console.log('Task update received:', data);
      if (data.total_tasks !== undefined) {
        setTaskStats(data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    });

    // Subscribe to robots room for real-time robot updates
    const unsubscribeRobots = subscribeToRobotsRoom((data: any) => {
      console.log('Robot update received:', data);
      if (data.total_robots !== undefined) {
        setRobotStats(data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    });

    // Subscribe to system room for real-time system health updates
    const unsubscribeSystem = subscribeToSystemRoom((data: any) => {
      console.log('System update received:', data);
      if (data.health_score !== undefined) {
        setSystemHealth(data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeTasks();
      unsubscribeRobots();
      unsubscribeSystem();
      unsubscribeFromAll();
    };
  }, []);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-600/20 border-green-500/50 text-green-400';
      case 'WARNING':
        return 'bg-yellow-600/20 border-yellow-500/50 text-yellow-400';
      case 'CRITICAL':
        return 'bg-red-600/20 border-red-500/50 text-red-400';
      default:
        return 'bg-accent-700/30 border-accent-600/50 text-accent-300';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'WARNING':
        return <AlertCircle className="w-5 h-5" />;
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary', label }: any) => (
    <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500/50 transition">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-accent-400">{title}</h3>
          <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
            <Icon className="w-5 h-5 text-primary-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-3xl font-bold text-white">{value}</p>
          {label && <p className="text-xs text-accent-500">{label}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-accent-400">Real-time warehouse operations monitoring</p>
        </div>
        <div className="text-right">
          {isLoading && <p className="text-accent-400 text-sm animate-pulse">Loading...</p>}
          {!isLoading && lastUpdate && (
            <p className="text-accent-500 text-xs">Last update: {lastUpdate}</p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-600/20 border border-red-500/50 rounded-xl p-4 text-red-300 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* System Health Card */}
      <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">System Health</h2>
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${getHealthStatusColor(systemHealth.status)}`}>
              {getHealthIcon(systemHealth.status)}
              <span className="font-semibold text-sm">{systemHealth.status}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Health Score Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-accent-400 font-medium">Health Score</span>
                <span className="text-white font-bold text-lg">{systemHealth.health_score}%</span>
              </div>
              <div className="w-full bg-accent-800 rounded-full h-3 overflow-hidden border border-accent-700">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                  style={{ width: `${Math.min(systemHealth.health_score, 100)}%` }}
                />
              </div>
            </div>

            {/* Health Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <p className="text-xs text-accent-500 mb-1">Average Battery</p>
                <p className="text-2xl font-bold text-primary-300">{(systemHealth.average_battery_level ?? 0).toFixed(1)}%</p>
              </div>

              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <p className="text-xs text-accent-500 mb-1">Active Tasks</p>
                <p className="text-2xl font-bold text-primary-300">{systemHealth.active_tasks_count}</p>
              </div>

              {systemHealth.timestamp && (
                <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                  <p className="text-xs text-accent-500 mb-1">Last Check</p>
                  <p className="text-sm font-mono text-accent-200">
                    {new Date(systemHealth.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Statistics */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Task Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tasks"
            value={taskStats.total_tasks}
            icon={Activity}
            label="All time tasks"
          />
          <StatCard
            title="Assigned"
            value={taskStats.assigned_tasks}
            icon={CheckCircle2}
            label="Currently assigned"
          />
          <StatCard
            title="In Progress"
            value={taskStats.in_progress_tasks}
            icon={TrendingUp}
            label="Being executed"
          />
          <StatCard
            title="Completed"
            value={taskStats.completed_tasks}
            icon={CheckCircle2}
            label="Successfully done"
          />
        </div>

        {/* Task Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md p-6">
            <h3 className="text-sm font-semibold text-accent-400 mb-4">Completion Rate</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-accent-300">Tasks Completed / Total</span>
                <span className="text-2xl font-bold text-primary-300">
                  {(taskStats.completion_rate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-accent-800 rounded-full h-2 border border-accent-700">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
                  style={{ width: `${Math.min(taskStats.completion_rate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md p-6">
            <h3 className="text-sm font-semibold text-accent-400 mb-4">Success Rate</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-accent-300">Successful Tasks %</span>
                <span className="text-2xl font-bold text-green-400">
                  {(taskStats.success_rate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-accent-800 rounded-full h-2 border border-accent-700">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400"
                  style={{ width: `${Math.min(taskStats.success_rate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Failed Tasks Alert */}
        {taskStats.failed_tasks > 0 && (
          <div className="mt-4 bg-red-600/10 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">
              <strong>{taskStats.failed_tasks}</strong> task{taskStats.failed_tasks !== 1 ? 's' : ''} failed - check logs for details
            </span>
          </div>
        )}
      </div>

      {/* Robot Statistics */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Robot Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Robots"
            value={robotStats.total_robots}
            icon={Activity}
            label="In warehouse"
          />
          <StatCard
            title="Available"
            value={robotStats.available_robots}
            icon={CheckCircle2}
            label="Ready for tasks"
          />
          <StatCard
            title="Busy"
            value={robotStats.busy_robots}
            icon={TrendingUp}
            label="Executing tasks"
          />
          <StatCard
            title="Offline"
            value={robotStats.offline_robots}
            icon={AlertCircle}
            label="Not connected"
          />
        </div>

        {/* Robot Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent-400">Average Battery Level</h3>
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-3">
              <p className="text-3xl font-bold text-primary-300">
                {(robotStats.average_battery_level ?? 0).toFixed(1)}%
              </p>
              <div className="w-full bg-accent-800 rounded-full h-2 border border-accent-700">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                  style={{ width: `${Math.min(robotStats.average_battery_level, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md p-6">
            <h3 className="text-sm font-semibold text-accent-400 mb-4">Average Temperature</h3>
            <div className="space-y-3">
              <p className="text-3xl font-bold text-primary-300">
                {(robotStats.average_temperature ?? 0).toFixed(1)}°C
              </p>
              <p className="text-xs text-accent-500">
                {robotStats.average_temperature > 70
                  ? 'High temperature - check cooling'
                  : robotStats.average_temperature > 50
                    ? 'Moderate temperature'
                    : 'Optimal temperature'}
              </p>
            </div>
          </div>
        </div>

        {/* Offline Robots Alert */}
        {robotStats.offline_robots > 0 && (
          <div className="mt-4 bg-yellow-600/10 border border-yellow-500/30 rounded-xl p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-300">
              <strong>{robotStats.offline_robots}</strong> robot{robotStats.offline_robots !== 1 ? 's' : ''} offline - check power and connections
            </span>
          </div>
        )}
      </div>

      {/* Real-time Status Indicator */}
      <div className="flex items-center space-x-2 text-xs text-accent-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Real-time monitoring active</span>
      </div>
    </div>
  );
}
