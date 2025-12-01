import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

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

  // Listen for telemetry (robot location) updates from new backend architecture
  socket.on('telemetry', (data) => {
    console.log('[WS] Robot telemetry update:', data);
    // data contains: robot, robot_id, x, y, status, battery_level, temperature, cpu_usage, ram_usage, etc.
    // Sent from: MQTT telemetry_handler -> robot_service -> socket_events.emit_robot_telemetry()
  });

  // Listen for map updates
  socket.on('map_update', (data) => {
    console.log('[WS] Map updated:', data);
    // data contains: width, height, resolution, data (occupancy grid)
    // Sent from: map_handler -> socket_events.emit_map_update()
  });

  // Listen for robot status changes
  socket.on('robot_status', (data) => {
    console.log('[WS] Robot status changed:', data);
    // data contains: robot_id, status (IDLE, MOVING, BUSY, CHARGING, ERROR, OFFLINE)
    // Sent from: robot_service -> socket_events.emit_robot_status()
  });

  // Listen for task status updates
  socket.on('task_status', (data) => {
    console.log('[WS] Task status changed:', data);
    // data contains: task_id, status, robot_id
    // Sent from: task_service -> socket_events.emit_task_status()
  });

  // Listen for error events
  socket.on('error', (data) => {
    console.error('[WS] Error event:', data);
    // data contains: message, error_code
    // Sent from: socket_events.emit_error()
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
