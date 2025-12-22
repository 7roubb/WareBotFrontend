/**
 * Task-specific WebSocket handlers for real-time task and map updates
 * Handles task status changes, robot positions, and shelf locations
 */

import { io, Socket } from 'socket.io-client';

interface TaskMapData {
  task_id: string;
  robot_id?: string;
  status: string;
  type?: string;
  robot: {
    x: number;
    y: number;
  };
  shelf: {
    id: string;
    x: number;
    y: number;
    original?: boolean;
  };
  drop_zone?: {
    id: string;
    x: number;
    y: number;
    original?: boolean;
  };
  phase?: string;
  current_target?: string;
  created_at?: string;
  started_at?: string;
  last_updated?: string;
}

interface RobotPositionUpdate {
  task_id: string;
  robot: {
    x: number;
    y: number;
  };
  status: string;
  timestamp: string;
}

interface TaskStatusChange {
  task_id: string;
  old_status: string;
  new_status: string;
  current_target?: string;
  robot: {
    x: number;
    y: number;
  };
  shelf?: {
    id: string;
    x: number;
    y: number;
  };
  drop_zone?: {
    id: string;
    x: number;
    y: number;
  };
  timestamp: string;
}

interface ShelfLocationFixed {
  task_id: string;
  shelf_id: string;
  x: number;
  y: number;
  note: string;
  timestamp: string;
}

interface AllTasksMapUpdate {
  tasks: TaskMapData[];
  timestamp: string;
}

type TaskWebSocketCallback = (data: unknown) => void;

class TaskWebSocketManager {
  private socket: Socket | null = null;
  private callbackRegistry: Record<string, Set<TaskWebSocketCallback>> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;

  /**
   * Get the WebSocket URL from environment or compute from current location
   */
  private getWebSocketUrl(): string {
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    if (envUrl?.length) return envUrl;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:5000`;
  }

  /**
   * Get JWT token from localStorage
   */
  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('access_token') || localStorage.getItem('token') || null;
    } catch (e) {
      console.warn('[Task WS] Failed to read auth token:', e);
      return null;
    }
  }

  /**
   * Connect to WebSocket server with task handlers
   */
  public connect(): Socket | null {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.socket;
    }

    this.isConnecting = true;

    try {
      const token = this.getAuthToken();
      const url = this.getWebSocketUrl();

      this.socket = io(url, {
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling'],
      });

      // =====================================================================
      // CONNECTION LIFECYCLE
      // =====================================================================
      this.socket.on('connect', () => {
        console.log('[Task WS] Connected to WebSocket', url, 'ID:', this.socket?.id);
        this.reconnectAttempts = 0;
        this.invokeCallbacks('connect', { connected: true });
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Task WS] Disconnected from WebSocket:', reason);
        this.invokeCallbacks('disconnect', { connected: false, reason });
      });

      this.socket.on('connect_error', (error) => {
        console.warn('[Task WS] Connection error:', error?.message || error);
        this.invokeCallbacks('error', {
          type: 'connection_error',
          message: error?.message || 'Connection error',
        });
      });

      this.socket.on('reconnect_attempt', (attempt) => {
        this.reconnectAttempts = attempt;
        console.log('[Task WS] Reconnection attempt:', attempt);
        this.invokeCallbacks('reconnect_attempt', { attempt });
      });

      // =====================================================================
      // TASK-SPECIFIC EVENT HANDLERS
      // =====================================================================

      /**
       * Connection response from server
       */
      this.socket.on('connection_response', (data: unknown) => {
        console.log('[Task WS] Connection response:', data);
        this.invokeCallbacks('connection_response', data);
      });

      /**
       * Subscription confirmation
       */
      this.socket.on('subscribed', (data: unknown) => {
        console.log('[Task WS] Subscribed to task:', (data as Record<string, unknown>)?.task_id);
        this.invokeCallbacks('subscribed', data);
      });

      this.socket.on('unsubscribed', (data: unknown) => {
        console.log('[Task WS] Unsubscribed from task:', (data as Record<string, unknown>)?.task_id);
        this.invokeCallbacks('unsubscribed', data);
      });

      this.socket.on('map_subscribed', (data: unknown) => {
        console.log('[Task WS] Subscribed to map updates');
        this.invokeCallbacks('map_subscribed', data);
      });

      /**
       * Robot position update (real-time during task execution)
       * Only robot position changes, shelf location is FIXED
       */
      this.socket.on('robot_position_update', (data: RobotPositionUpdate) => {
        console.log('[Task WS] Robot position update:', data);
        this.invokeCallbacks('robot_position_update', data);
      });

      /**
       * Task status change event
       * Emitted when task status changes (PENDING -> ASSIGNED -> MOVING_TO_SHELF etc)
       */
      this.socket.on('task_status_change', (data: TaskStatusChange) => {
        console.log('[Task WS] Task status changed:', data);
        this.invokeCallbacks('task_status_change', data);
      });

      /**
       * Shelf location fixed notification
       * Indicates that shelf location won't change during task execution
       */
      this.socket.on('shelf_location_fixed', (data: ShelfLocationFixed) => {
        console.log('[Task WS] Shelf location fixed:', data);
        this.invokeCallbacks('shelf_location_fixed', data);
      });

      /**
       * All tasks map data update
       * Contains all active tasks formatted for map display
       */
      this.socket.on('all_tasks_map_update', (data: AllTasksMapUpdate) => {
        console.log('[Task WS] All tasks map update received, tasks:', data.tasks.length);
        this.invokeCallbacks('all_tasks_map_update', data);
      });

      /**
       * Single task data response
       */
      this.socket.on('task_data', (data: unknown) => {
        console.log('[Task WS] Task data received:', (data as Record<string, Record<string, unknown>>)?.task?.task_id);
        this.invokeCallbacks('task_data', data);
      });

      /**
       * Map data response
       */
      this.socket.on('map_data', (data: unknown) => {
        console.log('[Task WS] Map data received, tasks:', (data as Record<string, unknown[]>)?.tasks?.length || 0);
        this.invokeCallbacks('map_data', data);
      });

      this.isConnecting = false;
      return this.socket;
    } catch (error) {
      console.error('[Task WS] Failed to initialize socket:', error);
      this.isConnecting = false;
      return null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.callbackRegistry = {};
    }
  }

  /**
   * Get current socket instance
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Subscribe to task updates
   */
  public subscribeToTask(taskId: string): void {
    if (!this.socket?.connected) {
      console.warn('[Task WS] Socket not connected, cannot subscribe');
      return;
    }
    console.log('[Task WS] Subscribing to task:', taskId);
    this.socket.emit('subscribe_task', { task_id: taskId });
  }

  /**
   * Unsubscribe from task updates
   */
  public unsubscribeFromTask(taskId: string): void {
    if (!this.socket?.connected) {
      console.warn('[Task WS] Socket not connected, cannot unsubscribe');
      return;
    }
    console.log('[Task WS] Unsubscribing from task:', taskId);
    this.socket.emit('unsubscribe_task', { task_id: taskId });
  }

  /**
   * Subscribe to map updates (all tasks)
   */
  public subscribeToMap(): void {
    if (!this.socket?.connected) {
      console.warn('[Task WS] Socket not connected, cannot subscribe to map');
      return;
    }
    console.log('[Task WS] Subscribing to map updates');
    this.socket.emit('subscribe_map');
  }

  /**
   * Request task data on demand
   */
  public requestTaskData(taskId: string): void {
    if (!this.socket?.connected) {
      console.warn('[Task WS] Socket not connected, cannot request task data');
      return;
    }
    console.log('[Task WS] Requesting task data for:', taskId);
    this.socket.emit('request_task_data', { task_id: taskId });
  }

  /**
   * Request all tasks map data on demand
   */
  public requestMapData(): void {
    if (!this.socket?.connected) {
      console.warn('[Task WS] Socket not connected, cannot request map data');
      return;
    }
    console.log('[Task WS] Requesting all tasks map data');
    this.socket.emit('request_map_data');
  }

  /**
   * Register callback for event
   */
  public on(eventName: string, callback: TaskWebSocketCallback): () => void {
    if (!this.callbackRegistry[eventName]) {
      this.callbackRegistry[eventName] = new Set();
    }
    this.callbackRegistry[eventName].add(callback);

    // Return unsubscribe function
    return () => {
      if (this.callbackRegistry[eventName]) {
        this.callbackRegistry[eventName].delete(callback);
      }
    };
  }

  /**
   * Invoke all callbacks for an event
   */
  private invokeCallbacks(eventName: string, data: unknown): void {
    if (this.callbackRegistry[eventName]) {
      this.callbackRegistry[eventName].forEach((cb) => {
        try {
          cb(data);
        } catch (error) {
          console.error(`[Task WS] Error invoking callback for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Remove all callbacks
   */
  public clearCallbacks(): void {
    this.callbackRegistry = {};
  }

  /**
   * Get connection state
   */
  public getConnectionState(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }
}

// Create singleton instance
const taskWebSocketManager = new TaskWebSocketManager();

// Export convenience functions
export const connectTaskWebSocket = () => taskWebSocketManager.connect();
export const disconnectTaskWebSocket = () => taskWebSocketManager.disconnect();
export const getTaskWebSocket = () => taskWebSocketManager.getSocket();
export const isTaskWebSocketConnected = () => taskWebSocketManager.isConnected();
export const subscribeToTask = (taskId: string) => taskWebSocketManager.subscribeToTask(taskId);
export const unsubscribeFromTask = (taskId: string) => taskWebSocketManager.unsubscribeFromTask(taskId);
export const subscribeToMapUpdates = () => taskWebSocketManager.subscribeToMap();
export const requestTaskData = (taskId: string) => taskWebSocketManager.requestTaskData(taskId);
export const requestMapData = () => taskWebSocketManager.requestMapData();
export const onTaskWebSocketEvent = (eventName: string, callback: TaskWebSocketCallback) =>
  taskWebSocketManager.on(eventName, callback);
export const clearTaskWebSocketCallbacks = () => taskWebSocketManager.clearCallbacks();
export const getTaskWebSocketState = () => taskWebSocketManager.getConnectionState();

export default taskWebSocketManager;
