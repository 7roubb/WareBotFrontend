/**
 * Real-time Task Dashboard Component
 * Displays live task updates with robot positions and status tracking
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, Activity, CheckCircle, Clock, MapPin, Bot, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { useRealTimeTasks } from '../hooks/useRealTimeTasks';

interface TaskViewProps {
  compact?: boolean;
  maxTasks?: number;
}

const TaskStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-4 h-4" /> },
    ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Activity className="w-4 h-4" /> },
    MOVING_TO_SHELF: { bg: 'bg-purple-100', text: 'text-purple-800', icon: <MapPin className="w-4 h-4" /> },
    PICKING: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <Bot className="w-4 h-4" /> },
    MOVING_TO_DROP: { bg: 'bg-pink-100', text: 'text-pink-800', icon: <TrendingUp className="w-4 h-4" /> },
    DROPPING: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Activity className="w-4 h-4" /> },
    RETURNING: { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: <TrendingUp className="w-4 h-4" /> },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
  };

  const config = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: <AlertCircle className="w-4 h-4" /> };

  return (
    <div className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit`}>
      {config.icon}
      {status}
    </div>
  );
};

interface TaskCardProps {
  task: {
    task_id: string;
    type?: string;
    status: string;
    robot: { x: number; y: number };
    shelf: { x: number; y: number; id: string };
    drop_zone?: { x: number; y: number; id: string };
    current_target?: string;
    robot_id?: string;
    last_updated?: string;
  };
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleTimeString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Task {task.task_id.slice(0, 8)}</h3>
          <p className="text-sm text-gray-500">Type: {task.type || 'PICKUP_AND_DELIVER'}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <p className="text-gray-600">Robot Position</p>
          <p className="font-mono text-gray-900">
            ({task.robot.x.toFixed(2)}, {task.robot.y.toFixed(2)})
          </p>
        </div>

        <div className="bg-gray-50 p-2 rounded">
          <p className="text-gray-600">Shelf Location</p>
          <p className="font-mono text-gray-900">
            ({task.shelf.x.toFixed(2)}, {task.shelf.y.toFixed(2)})
          </p>
        </div>

        {task.drop_zone && (
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-600">Drop Zone</p>
            <p className="font-mono text-gray-900">
              ({task.drop_zone.x.toFixed(2)}, {task.drop_zone.y.toFixed(2)})
            </p>
          </div>
        )}

        {task.current_target && (
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-600">Current Target</p>
            <p className="font-mono text-gray-900">{task.current_target}</p>
          </div>
        )}
      </div>

      {task.robot_id && (
        <div className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Robot:</span> {task.robot_id}
        </div>
      )}

      <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
        <p>Updated: {formatTime(task.last_updated)}</p>
      </div>
    </div>
  );
};

const ConnectionStatus: React.FC<{ connected: boolean; error?: string | null }> = ({ connected, error }) => {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
      connected
        ? 'bg-green-50 text-green-700'
        : 'bg-red-50 text-red-700'
    }`}>
      {connected ? (
        <>
          <Wifi className="w-4 h-4" />
          Connected
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          Disconnected {error && `(${error})`}
        </>
      )}
    </div>
  );
};

export const RealTimeTaskDashboard: React.FC<TaskViewProps> = ({ compact = false, maxTasks = 10 }) => {
  const { taskList, activeTasks, wsConnected, wsError, isInitializing, subscribeToMapUpdates } = useRealTimeTasks();
  const [displayTasks, setDisplayTasks] = useState(activeTasks);

  useEffect(() => {
    if (!isInitializing) {
      subscribeToMapUpdates();
    }
  }, [isInitializing, subscribeToMapUpdates]);

  useEffect(() => {
    setDisplayTasks(activeTasks.slice(0, maxTasks));
  }, [activeTasks, maxTasks]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-gray-600">Initializing real-time updates...</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Active Tasks</h3>
          <ConnectionStatus connected={wsConnected} error={wsError} />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-900 font-medium">
            {activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''}
          </p>
        </div>

        {displayTasks.length > 0 ? (
          <div className="space-y-2">
            {displayTasks.map((task) => (
              <div key={task.task_id} className="bg-gray-50 rounded p-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-gray-700">{task.task_id.slice(0, 8)}...</span>
                  <TaskStatusBadge status={task.status} />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Robot: ({task.robot.x.toFixed(1)}, {task.robot.y.toFixed(1)})
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">No active tasks</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real-Time Task Monitor</h2>
          <p className="text-gray-600">Live task status and robot position tracking</p>
        </div>
        <ConnectionStatus connected={wsConnected} error={wsError} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-600 font-semibold">Total Tasks</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{taskList.length}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600 font-semibold">Active Tasks</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{activeTasks.length}</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-purple-600 font-semibold">Completed</p>
          <p className="text-3xl font-bold text-purple-900 mt-1">
            {taskList.filter((t) => t.status === 'COMPLETED').length}
          </p>
        </div>
      </div>

      {/* Tasks grid */}
      {displayTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTasks.map((task) => (
            <TaskCard key={task.task_id} task={task} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No active tasks at the moment</p>
        </div>
      )}

      {/* Info footer */}
      {displayTasks.length > 0 && activeTasks.length > maxTasks && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          Showing {displayTasks.length} of {activeTasks.length} active tasks
        </div>
      )}
    </div>
  );
};

export default RealTimeTaskDashboard;
