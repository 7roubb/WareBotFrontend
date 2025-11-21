import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectWebSocket = () => {
  if (socket) return socket;

  socket = io('http://localhost:5000', {
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
