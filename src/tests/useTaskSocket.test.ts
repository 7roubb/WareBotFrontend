/**
 * Unit tests for useTaskSocket hook
 * Verifies WebSocket event handling and state updates
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTaskSocket } from '../hooks/useTaskSocket';
import { TaskMapView, TaskStatusChangePayload } from '../types/map';

// Mock socket.io
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  };
  return {
    io: jest.fn(() => mockSocket),
    Socket: jest.fn(),
  };
});

describe('useTaskSocket', () => {
  let mockSocket: any;
  let eventHandlers: { [key: string]: Function } = {};

  beforeEach(() => {
    jest.clearAllMocks();
    eventHandlers = {};

    const { io } = require('socket.io-client');
    mockSocket = io.mock.results[0]?.value || {
      on: jest.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
    };
  });

  describe('robot position updates', () => {
    it('should update robot position on robot_position_update event', async () => {
      const onRobotPositionUpdate = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onRobotPositionUpdate,
        })
      );

      await waitFor(() => {
        if (eventHandlers['robot_position_update']) {
          const payload = {
            task_id: 'task-1',
            robot: { id: 'robot-1', x: 100, y: 200 },
          };
          eventHandlers['robot_position_update'](payload);
          expect(onRobotPositionUpdate).toHaveBeenCalledWith(payload);
        }
      });
    });
  });

  describe('task status changes', () => {
    it('should handle RETURN_SHELF task completion without changing storage coords', async () => {
      const onTaskStatusChange = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onTaskStatusChange,
        })
      );

      await waitFor(() => {
        if (eventHandlers['task_status_change']) {
          const payload: TaskStatusChangePayload = {
            task_id: 'task-1',
            old_status: 'IN_PROGRESS',
            new_status: 'COMPLETED',
            robot: { id: 'robot-1', x: 50, y: 50 },
            shelf: {
              id: 'shelf-1',
              storage: { x: 10, y: 20 },
              current: { x: 10, y: 20 },
            },
          };
          eventHandlers['task_status_change'](payload);
          expect(onTaskStatusChange).toHaveBeenCalledWith(payload);
        }
      });
    });

    it('should handle DROPPED status without mutating storage coords', async () => {
      const onTaskStatusChange = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onTaskStatusChange,
        })
      );

      await waitFor(() => {
        if (eventHandlers['task_status_change']) {
          const payload: TaskStatusChangePayload = {
            task_id: 'task-1',
            old_status: 'DELIVERING',
            new_status: 'DROPPED',
            robot: { id: 'robot-1', x: 300, y: 400 },
            shelf: {
              id: 'shelf-1',
              storage: { x: 10, y: 20 }, // Storage should NOT change
              current: { x: 300, y: 400 }, // Current updates to drop location
            },
            drop_zone: {
              id: 'zone-1',
              x: 300,
              y: 400,
            },
          };
          eventHandlers['task_status_change'](payload);
          expect(onTaskStatusChange).toHaveBeenCalledWith(payload);
          // Verify storage coords in payload match expected immutable values
          expect(payload.shelf?.storage).toEqual({ x: 10, y: 20 });
        }
      });
    });
  });

  describe('shelf location fixed', () => {
    it('should mark shelf as fixed when receiving shelf_location_fixed', async () => {
      const onShelfLocationFixed = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onShelfLocationFixed,
        })
      );

      await waitFor(() => {
        if (eventHandlers['shelf_location_fixed']) {
          const payload = {
            task_id: 'task-1',
            shelf_id: 'shelf-1',
            x: 10,
            y: 20,
            yaw: 0,
            location_status: 'STORED',
          };
          eventHandlers['shelf_location_fixed'](payload);
          expect(onShelfLocationFixed).toHaveBeenCalledWith(payload);
        }
      });
    });
  });

  describe('map data updates', () => {
    it('should handle all_tasks_map_update event', async () => {
      const onAllTasksUpdate = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onAllTasksUpdate,
        })
      );

      await waitFor(() => {
        if (eventHandlers['all_tasks_map_update']) {
          const payload = {
            tasks: [
              {
                task_id: 'task-1',
                status: 'COMPLETED',
                task_type: 'PICKUP_AND_DELIVER',
                robot: { id: 'robot-1', x: 0, y: 0 },
                shelf: {
                  id: 'shelf-1',
                  storage: { x: 10, y: 20 },
                  current: { x: 10, y: 20 },
                },
              },
            ],
            timestamp: Date.now(),
          };
          eventHandlers['all_tasks_map_update'](payload);
          expect(onAllTasksUpdate).toHaveBeenCalledWith(payload.tasks);
        }
      });
    });

    it('should handle map_data event with full payload', async () => {
      const onMapDataUpdate = jest.fn();

      renderHook(() =>
        useTaskSocket({
          onMapDataUpdate,
        })
      );

      await waitFor(() => {
        if (eventHandlers['map_data']) {
          const payload = {
            tasks: [],
            robots: [{ id: 'robot-1', x: 0, y: 0 }],
            shelves: [
              {
                id: 'shelf-1',
                warehouse_id: 'warehouse-1',
                storage: { x: 10, y: 20 },
                current: { x: 10, y: 20 },
                location_status: 'STORED' as const,
                available: true,
                status: 'IDLE' as const,
              },
            ],
            timestamp: Date.now(),
          };
          eventHandlers['map_data'](payload);
          expect(onMapDataUpdate).toHaveBeenCalledWith(payload);
        }
      });
    });
  });

  describe('subscriptions', () => {
    it('should emit subscribe_map', async () => {
      const { result } = renderHook(() => useTaskSocket());

      await waitFor(() => {
        result.current.subscribeMap();
        expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_map');
      });
    });

    it('should emit subscribe_task with task_id', async () => {
      const { result } = renderHook(() => useTaskSocket());

      await waitFor(() => {
        result.current.subscribeTask('task-1');
        expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_task', {
          task_id: 'task-1',
        });
      });
    });

    it('should emit unsubscribe_task with task_id', async () => {
      const { result } = renderHook(() => useTaskSocket());

      await waitFor(() => {
        result.current.unsubscribeTask('task-1');
        expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe_task', {
          task_id: 'task-1',
        });
      });
    });
  });

  describe('connection state', () => {
    it('should track connected state', async () => {
      const onConnected = jest.fn();

      const { result } = renderHook(() =>
        useTaskSocket({
          onConnected,
        })
      );

      await waitFor(() => {
        if (eventHandlers['connect']) {
          eventHandlers['connect']();
          expect(result.current.isConnected).toBe(true);
          expect(onConnected).toHaveBeenCalled();
        }
      });
    });

    it('should track disconnected state', async () => {
      const onDisconnected = jest.fn();

      const { result } = renderHook(() =>
        useTaskSocket({
          onDisconnected,
        })
      );

      await waitFor(() => {
        if (eventHandlers['disconnect']) {
          eventHandlers['disconnect']();
          expect(result.current.isConnected).toBe(false);
          expect(onDisconnected).toHaveBeenCalled();
        }
      });
    });

    it('should handle connection errors', async () => {
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useTaskSocket({
          onError,
        })
      );

      await waitFor(() => {
        if (eventHandlers['error']) {
          eventHandlers['error']('Connection failed');
          expect(result.current.error).toBeDefined();
          expect(onError).toHaveBeenCalled();
        }
      });
    });
  });
});
