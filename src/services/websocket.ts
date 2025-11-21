import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Determine WebSocket URL - use window.location.hostname for the same host
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:5000`;
};

export const connectWebSocket = () => {
  if (socket) return socket;

  socket = io(getWebSocketUrl(), {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
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
