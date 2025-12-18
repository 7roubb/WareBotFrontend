import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Callback registries for real-time events
const callbackRegistry: Record<string, Set<Function>> = {};

// Determine WebSocket URL. Prefer `VITE_WS_URL` if provided (e.g. ws://localhost:5000),
// otherwise connect to same host on port 5000.
const getWebSocketUrl = () => {
  const envUrl = (import.meta.env && import.meta.env.VITE_WS_URL) as string | undefined;
  if (envUrl && envUrl.length) return envUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:5000`;
};

// Helper to read JWT token from localStorage. Adjust key if your app uses a different key.
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('access_token') || localStorage.getItem('token') || null;
  } catch (e) {
    return null;
  }
};

export const connectWebSocket = () => {
  if (socket) return socket;

  const token = getAuthToken();

  socket = io(getWebSocketUrl(), {
    // Allow the client and server to negotiate transport. Forcing
    // `websocket` only can cause immediate failures when the server
    // environment or proxy doesn't support raw websockets. Let socket.io
    // choose the best transport (websocket or polling).
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected to WebSocket', getWebSocketUrl(), 'id=', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Disconnected from WebSocket', reason);
  });

  socket.on('connect_error', (err) => {
    try {
      console.warn('[WS] connect_error', err?.message || err);
    } catch (e) {
      console.warn('[WS] connect_error (non-serializable error)');
    }
  });
  socket.on('reconnect_attempt', (n) => console.log('[WS] reconnect_attempt', n));

  // ============================================================================
  // LEGACY EVENT LISTENERS (for backward compatibility)
  // ============================================================================

  // Listen for telemetry (robot location) updates from new backend architecture
  socket.on('telemetry', (data) => {
    console.log('[WS] Robot telemetry update:', data);
    invokeCallbacks('telemetry', data);
    // data contains: robot, robot_id, x, y, status, battery_level, temperature, cpu_usage, ram_usage, etc.
    // Sent from: MQTT telemetry_handler -> robot_service -> socket_events.emit_robot_telemetry()
  });

  // Listen for map updates
  socket.on('map_update', (data) => {
    console.log('[WS] Map updated:', data);
    invokeCallbacks('map_update', data);
    // data contains: width, height, resolution, data (occupancy grid)
    // Sent from: map_handler -> socket_events.emit_map_update()
  });

  // Listen for robot status changes
  socket.on('robot_status', (data) => {
    console.log('[WS] Robot status changed:', data);
    invokeCallbacks('robot_status', data);
    // data contains: robot_id, status (IDLE, MOVING, BUSY, CHARGING, ERROR, OFFLINE)
    // Sent from: robot_service -> socket_events.emit_robot_status()
  });

  // Listen for task status updates
  socket.on('task_status', (data) => {
    console.log('[WS] Task status changed:', data);
    invokeCallbacks('task_status', data);
    // data contains: task_id, status, robot_id
    // Sent from: task_service -> socket_events.emit_task_status()
  });

  // Listen for error events
  socket.on('error', (data) => {
    console.error('[WS] Error event:', data);
    invokeCallbacks('error', data);
    // data contains: message, error_code
    // Sent from: socket_events.emit_error()
  });

  // ============================================================================
  // NEW EVENT LISTENERS (from MQTT handlers with WebSocket room emission)
  // ============================================================================

  // Real-time task updates (from robots/mp400/+/task_status MQTT or robot/+/task/progress)
  socket.on('task_update', (data) => {
    console.log('[WS] Task update:', data);
    invokeCallbacks('task_update', data);
    // data contains: task_id, status, updated_at, robot_id, current_action
  });

  // Real-time robot updates (from robot/+/position/update MQTT)
  socket.on('robot_update', (data) => {
    console.log('[WS] Robot update:', data);
    invokeCallbacks('robot_update', data);
    // data contains: robot_id, x, y, yaw, status, battery_level
  });

  // Real-time shelf updates (from robot/+/shelf/location MQTT)
  socket.on('shelf_update', (data) => {
    console.log('[WS] Shelf update:', data);
    invokeCallbacks('shelf_update', data);
    // data contains: shelf_id, location_status, x_coord, y_coord, storage_x, storage_y
  });

  // Detailed shelf location info (current + storage location)
  socket.on('shelf_location_update', (data) => {
    console.log('[WS] Shelf location update:', data);
    invokeCallbacks('shelf_location_update', data);
    // data contains: shelf_id, storage_x, storage_y, storage_yaw, x_coord, y_coord, yaw, location_status
  });

  // Robot position updates
  socket.on('robot_position_update', (data) => {
    console.log('[WS] Robot position update:', data);
    invokeCallbacks('robot_position_update', data);
    // data contains: robot_id, x, y, yaw
  });

  // Task progress updates
  socket.on('task_progress_update', (data) => {
    console.log('[WS] Task progress update:', data);
    invokeCallbacks('task_progress_update', data);
    // data contains: task_id, status, robot_id, progress_percent
  });

  // System health updates
  socket.on('system_update', (data) => {
    console.log('[WS] System update:', data);
    invokeCallbacks('system_update', data);
    // data contains: health_score, average_battery_level, active_tasks_count, status
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// ============================================================================
// CALLBACK REGISTRY HELPERS
// ============================================================================

const invokeCallbacks = (eventName: string, data: any) => {
  if (callbackRegistry[eventName]) {
    callbackRegistry[eventName].forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error invoking callback for ${eventName}:`, e);
      }
    });
  }
};

export const registerCallback = (eventName: string, callback: Function) => {
  if (!callbackRegistry[eventName]) {
    callbackRegistry[eventName] = new Set();
  }
  callbackRegistry[eventName].add(callback);
  
  // Return unsubscribe function
  return () => {
    if (callbackRegistry[eventName]) {
      callbackRegistry[eventName].delete(callback);
    }
  };
};

// ============================================================================
// ROOM SUBSCRIPTION FUNCTIONS
// ============================================================================

/**
 * Subscribe to tasks_room for real-time task updates
 */
export const subscribeToTasksRoom = (callback: (data: any) => void) => {
  const s = connectWebSocket();
  console.log('[WS] Subscribing to tasks_room');
  s.emit('subscribe_tasks');
  return registerCallback('task_update', callback);
};

/**
 * Subscribe to robots_room for real-time robot updates
 */
export const subscribeToRobotsRoom = (callback: (data: any) => void) => {
  const s = connectWebSocket();
  console.log('[WS] Subscribing to robots_room');
  s.emit('subscribe_robots');
  return registerCallback('robot_update', callback);
};

/**
 * Subscribe to shelves_room for real-time shelf updates
 */
export const subscribeTShelvesRoom = (callback: (data: any) => void) => {
  const s = connectWebSocket();
  console.log('[WS] Subscribing to shelves_room');
  s.emit('subscribe_shelves');
  return registerCallback('shelf_update', callback);
};

/**
 * Subscribe to system_room for real-time system health updates
 */
export const subscribeToSystemRoom = (callback: (data: any) => void) => {
  const s = connectWebSocket();
  console.log('[WS] Subscribing to system_room');
  s.emit('subscribe_system');
  return registerCallback('system_update', callback);
};

/**
 * Unsubscribe from all rooms
 */
export const unsubscribeFromAll = () => {
  const s = connectWebSocket();
  console.log('[WS] Unsubscribing from all rooms');
  s.emit('unsubscribe_tasks');
  s.emit('unsubscribe_robots');
  s.emit('unsubscribe_shelves');
  s.emit('unsubscribe_system');
};

// ============================================================================
// LEGACY EVENT HELPERS (for backward compatibility)
// ============================================================================

// Utility: attach a handler for a named event (returns an unsubscribe function)
export const onEvent = (event: string, cb: (...args: any[]) => void) => {
  const s = connectWebSocket();
  s.on(event, cb);
  return () => s.off(event, cb);
};

// Helper: Listen for telemetry updates (robot location, status, etc.)
export const onTelemetry = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to telemetry events');
  return onEvent('telemetry', cb);
};

// Helper: Listen for map updates
export const onMapUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to map_update events');
  return onEvent('map_update', cb);
};

// Helper: Listen for robot status changes
export const onRobotStatus = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to robot_status events');
  return onEvent('robot_status', cb);
};

// Helper: Listen for task status updates
export const onTaskStatus = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to task_status events');
  return onEvent('task_status', cb);
};

// Helper: Listen for error events
export const onError = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to error events');
  return onEvent('error', cb);
};

// Helper: Listen for connection state changes
export const onConnectionChange = (cb: (connected: boolean) => void) => {
  const s = connectWebSocket();
  
  const handleConnect = () => {
    console.log('[WS] Connection state: CONNECTED');
    cb(true);
  };
  
  const handleDisconnect = () => {
    console.log('[WS] Connection state: DISCONNECTED');
    cb(false);
  };
  
  s.on('connect', handleConnect);
  s.on('disconnect', handleDisconnect);
  
  return () => {
    s.off('connect', handleConnect);
    s.off('disconnect', handleDisconnect);
  };
};

// ============================================================================
// NEW HELPER FUNCTIONS FOR REAL-TIME EVENTS
// ============================================================================

/**
 * Listen for real-time task updates
 */
export const onTaskUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to task_update events');
  return registerCallback('task_update', cb);
};

/**
 * Listen for real-time robot updates
 */
export const onRobotUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to robot_update events');
  return registerCallback('robot_update', cb);
};

/**
 * Listen for real-time shelf updates
 */
export const onShelfUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to shelf_update events');
  return registerCallback('shelf_update', cb);
};

/**
 * Listen for real-time shelf location updates (detailed)
 */
export const onShelfLocationUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to shelf_location_update events');
  return registerCallback('shelf_location_update', cb);
};

/**
 * Listen for real-time robot position updates
 */
export const onRobotPositionUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to robot_position_update events');
  return registerCallback('robot_position_update', cb);
};

/**
 * Listen for real-time task progress updates
 */
export const onTaskProgressUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to task_progress_update events');
  return registerCallback('task_progress_update', cb);
};

/**
 * Listen for real-time system health updates
 */
export const onSystemUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to system_update events');
  return registerCallback('system_update', cb);
};
