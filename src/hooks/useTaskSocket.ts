/**
 * WebSocket hook for real-time task and map updates
 * Handles all socket.io events and provides reconnection logic
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  TaskMapView,
  RobotPositionPayload,
  TaskStatusChangePayload,
  ShelfLocationFixedPayload,
  MapDataPayload,
  AllTasksMapUpdatePayload,
} from '../types/map';
import { mapApi } from '../api/mapApi';

interface UseTaskSocketOptions {
  onTaskUpdate?: (task: TaskMapView) => void;
  onRobotPositionUpdate?: (payload: RobotPositionPayload) => void;
  onTaskStatusChange?: (payload: TaskStatusChangePayload) => void;
  onShelfLocationFixed?: (payload: ShelfLocationFixedPayload) => void;
  onMapDataUpdate?: (payload: MapDataPayload) => void;
  onAllTasksUpdate?: (tasks: TaskMapView[]) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useTaskSocket(options: UseTaskSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectCountRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000; // 1 second

  // Exponential backoff for reconnection
  const getReconnectDelay = useCallback(() => {
    return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectCountRef.current), 30000);
  }, []);

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: getReconnectDelay(),
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    });

    // Connection event
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      reconnectCountRef.current = 0;
      setIsConnected(true);
      setError(null);
      options.onConnected?.();

      // Fetch latest map after reconnect to reconcile state
      mapApi
        .getAllTasksForMap()
        .then((tasks) => {
          options.onAllTasksUpdate?.(tasks);
        })
        .catch((err) => console.error('Failed to fetch map after reconnect:', err));
    });

    // Disconnect event
    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
      reconnectCountRef.current++;
      options.onDisconnected?.();
    });

    // Task update event
    socket.on('task_update', (data: { task: TaskMapView }) => {
      console.log('[Socket] task_update:', data);
      options.onTaskUpdate?.(data.task);
    });

    // Robot position update event
    socket.on('robot_position_update', (data: RobotPositionPayload) => {
      console.log('[Socket] robot_position_update:', data);
      options.onRobotPositionUpdate?.(data);
    });

    // Task status change event
    socket.on('task_status_change', (data: TaskStatusChangePayload) => {
      console.log('[Socket] task_status_change:', data);
      options.onTaskStatusChange?.(data);
    });

    // Shelf location fixed event (immutable storage coords confirmed)
    socket.on('shelf_location_fixed', (data: ShelfLocationFixedPayload) => {
      console.log('[Socket] shelf_location_fixed:', data);
      options.onShelfLocationFixed?.(data);
    });

    // Map data bulk update
    socket.on('map_data', (data: MapDataPayload) => {
      console.log('[Socket] map_data:', data);
      options.onMapDataUpdate?.(data);
    });

    // All tasks map update (alternative event name)
    socket.on('all_tasks_map_update', (data: AllTasksMapUpdatePayload) => {
      console.log('[Socket] all_tasks_map_update:', data);
      options.onAllTasksUpdate?.(data.tasks);
    });

    // Fallback for 'tasks_update' event
    socket.on('tasks_update', (data: { tasks: TaskMapView[] }) => {
      console.log('[Socket] tasks_update:', data);
      options.onAllTasksUpdate?.(data.tasks);
    });

    // Error event
    socket.on('error', (err: any) => {
      console.error('[Socket] Error:', err);
      const error = new Error(typeof err === 'string' ? err : JSON.stringify(err));
      setError(error);
      options.onError?.(error);
    });

    socketRef.current = socket;
  }, [getReconnectDelay, options]);

  // Subscribe to map updates
  const subscribeMap = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket] Not connected, skipping subscribe_map');
      return;
    }
    socketRef.current.emit('subscribe_map');
    console.log('[Socket] Emitted: subscribe_map');
  }, []);

  // Unsubscribe from map updates
  const unsubscribeMap = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket] Not connected, skipping unsubscribe_map');
      return;
    }
    socketRef.current.emit('unsubscribe_map');
    console.log('[Socket] Emitted: unsubscribe_map');
  }, []);

  // Subscribe to a specific task
  const subscribeTask = useCallback((taskId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket] Not connected, skipping subscribe_task');
      return;
    }
    socketRef.current.emit('subscribe_task', { task_id: taskId });
    console.log(`[Socket] Emitted: subscribe_task (${taskId})`);
  }, []);

  // Unsubscribe from a specific task
  const unsubscribeTask = useCallback((taskId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket] Not connected, skipping unsubscribe_task');
      return;
    }
    socketRef.current.emit('unsubscribe_task', { task_id: taskId });
    console.log(`[Socket] Emitted: unsubscribe_task (${taskId})`);
  }, []);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    subscribeMap,
    unsubscribeMap,
    subscribeTask,
    unsubscribeTask,
    disconnect,
    reconnect: connect,
  };
}
