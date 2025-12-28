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
  // PRIMARY TELEMETRY EVENT - MOST IMPORTANT FOR ROBOT POSITION
  // ============================================================================
  socket.on('telemetry', (data) => {
    console.log('[WS] Robot telemetry update:', data);
    invokeCallbacks('telemetry', data);
    // ALSO invoke robot_update callbacks so components can use either
    invokeCallbacks('robot_update', data);
  });

  // ============================================================================
  // LEGACY EVENT LISTENERS (for backward compatibility)
  // ============================================================================

  // Listen for map updates
  socket.on('map_update', (data) => {
    console.log('[WS] Map updated:', data);
    invokeCallbacks('map_update', data);
  });

  // Listen for robot status changes
  socket.on('robot_status', (data) => {
    console.log('[WS] Robot status changed:', data);
    invokeCallbacks('robot_status', data);
  });

  // Listen for task status updates
  socket.on('task_status', (data) => {
    console.log('[WS] Task status changed:', data);
    invokeCallbacks('task_status', data);
  });

  // Listen for error events
  socket.on('error', (data) => {
    console.error('[WS] Error event:', data);
    invokeCallbacks('error', data);
  });

  // ============================================================================
  // NEW EVENT LISTENERS (from MQTT handlers with WebSocket room emission)
  // ============================================================================

  // Real-time task updates (from robots/mp400/+/task_status MQTT or robot/+/task/progress)
  socket.on('task_update', (data) => {
    console.log('[WS] Task update:', data);
    invokeCallbacks('task_update', data);
  });

  // Real-time robot updates (from robot/+/position/update MQTT)
  socket.on('robot_update', (data) => {
    console.log('[WS] Robot update:', data);
    invokeCallbacks('robot_update', data);
  });

  // Real-time shelf updates (from robot/+/shelf/location MQTT)
  socket.on('shelf_update', (data) => {
    console.log('[WS] Shelf update:', data);
    invokeCallbacks('shelf_update', data);
  });

  // Detailed shelf location info (current + storage location)
  socket.on('shelf_location_update', (data) => {
    console.log('[WS] Shelf location update:', data);
    invokeCallbacks('shelf_location_update', data);
  });

  // Robot position updates
  socket.on('robot_position_update', (data) => {
    console.log('[WS] Robot position update:', data);
    invokeCallbacks('robot_position_update', data);
    // ALSO invoke robot_update for compatibility
    invokeCallbacks('robot_update', data);
  });

  // Task progress updates
  socket.on('task_progress_update', (data) => {
    console.log('[WS] Task progress update:', data);
    invokeCallbacks('task_progress_update', data);
  });

  // System health updates
  socket.on('system_update', (data) => {
    console.log('[WS] System update:', data);
    invokeCallbacks('system_update', data);
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
export const subscribeToShelvesRoom = (callback: (data: any) => void) => {
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
 * Subscribe to map updates
 */
export const subscribeToMapUpdates = (callback: (data: any) => void) => {
  const s = connectWebSocket();
  console.log('[WS] Subscribing to map updates');
  s.emit('subscribe_map');
  return registerCallback('map_data', callback);
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
  return registerCallback('telemetry', cb);
};

// Helper: Listen for map updates
export const onMapUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to map_update events');
  return registerCallback('map_update', cb);
};

// Helper: Listen for robot status changes
export const onRobotStatus = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to robot_status events');
  return registerCallback('robot_status', cb);
};

// Helper: Listen for task status updates
export const onTaskStatus = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to task_status events');
  return registerCallback('task_status', cb);
};

// Helper: Listen for error events
export const onError = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to error events');
  return registerCallback('error', cb);
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
 * Listen for real-time robot updates (includes telemetry)
 */
export const onRobotUpdate = (cb: (data: any) => void) => {
  console.log('[WS] Subscribing to robot_update events (includes telemetry)');
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

/**
 * Emit an event to the server
 */
export const emit = (event: string, data?: any) => {
  const s = connectWebSocket();
  if (s?.connected) {
    s.emit(event, data);
  } else {
    console.warn('[WS] Cannot emit, not connected');
  }
};

/**
 * Subscribe to a specific task
 */
export const subscribeToTask = (taskId: string) => {
  console.log('[WS] Subscribing to task:', taskId);
  emit('subscribe_task', { task_id: taskId });
};

/**
 * Unsubscribe from a specific task
 */
export const unsubscribeFromTask = (taskId: string) => {
  console.log('[WS] Unsubscribing from task:', taskId);
  emit('unsubscribe_task', { task_id: taskId });
};

/**
 * Request task data on demand
 */
export const requestTaskData = (taskId: string) => {
  console.log('[WS] Requesting task data:', taskId);
  emit('request_task_data', { task_id: taskId });
};

/**
 * Request map data on demand
 */
export const requestMapData = () => {
  console.log('[WS] Requesting map data');
  emit('request_map_data');
};