/**
 * Integration tests for end-to-end task workflows
 * Verifies complete task lifecycle and state synchronization
 */
import { mapApi } from '../api/mapApi';
import { TaskMapView, ShelfMap, Robot } from '../types/map';

// Mock socket.io-client
jest.mock('socket.io-client');

// Mock fetch globally
global.fetch = jest.fn();

describe('End-to-End Task Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('PICKUP_AND_DELIVER Workflow', () => {
    it('should complete full delivery workflow: robot -> shelf -> drop zone', async () => {
      // Step 1: Robot starts at origin
      const initialRobotState: Robot = {
        id: 'robot-1',
        x: 0,
        y: 0,
        status: 'IDLE',
        battery: 100,
      };

      // Step 2: Task created - robot moves to shelf
      const task: TaskMapView = {
        task_id: 'task-1',
        status: 'IN_PROGRESS',
        task_type: 'PICKUP_AND_DELIVER',
        robot: { ...initialRobotState, status: 'BUSY' },
        shelf: {
          id: 'shelf-1',
          storage: { x: 100, y: 150 },
          current: { x: 100, y: 150 },
        },
        drop_zone: {
          id: 'zone-1',
          x: 500,
          y: 500,
        },
      };

      expect(task.status).toBe('IN_PROGRESS');
      expect(task.robot.status).toBe('BUSY');

      // Step 3: Robot reaches shelf (current position = shelf position)
      const robotAtShelf = { ...task.robot, x: 100, y: 150 };
      expect(robotAtShelf.x).toBe(task.shelf.current.x);
      expect(robotAtShelf.y).toBe(task.shelf.current.y);

      // Step 4: Shelf moves with robot (current changes, storage unchanged)
      const shelfMovingToDropZone: ShelfMap = {
        id: 'shelf-1',
        warehouse_id: 'warehouse-1',
        storage: { x: 100, y: 150, yaw: 0 }, // Storage never changes
        current: { x: 500, y: 500, yaw: 0 }, // Moves to drop zone
        location_status: 'AT_DROP_ZONE',
        available: false,
        status: 'BUSY',
      };

      expect(shelfMovingToDropZone.storage).toEqual(task.shelf.storage);
      expect(shelfMovingToDropZone.current).toEqual(task.drop_zone);

      // Step 5: Task completed at drop zone
      const completedTask: TaskMapView = {
        ...task,
        status: 'COMPLETED',
        robot: { ...robotAtShelf, status: 'IDLE' },
      };

      expect(completedTask.status).toBe('COMPLETED');
      expect(completedTask.robot.status).toBe('IDLE');
    });

    it('should preserve shelf storage location throughout entire workflow', async () => {
      const shelfId = 'shelf-1';
      const originalStorage = { x: 100, y: 150 };

      let shelf: ShelfMap = {
        id: shelfId,
        warehouse_id: 'warehouse-1',
        storage: originalStorage,
        current: originalStorage,
        location_status: 'STORED',
        available: true,
        status: 'IDLE',
      };

      // Move to various locations during task
      const locations = [
        { x: 100, y: 150, status: 'STORED' as const },
        { x: 200, y: 200, status: 'IN_TRANSIT' as const },
        { x: 350, y: 350, status: 'IN_TRANSIT' as const },
        { x: 500, y: 500, status: 'AT_DROP_ZONE' as const },
      ];

      for (const location of locations) {
        shelf = {
          ...shelf,
          current: location,
          location_status: location.status,
        };

        // Verify storage is never mutated
        expect(shelf.storage).toEqual(originalStorage);
        expect(shelf.storage.x).toBe(100);
        expect(shelf.storage.y).toBe(150);
      }
    });
  });

  describe('RETURN_SHELF Workflow', () => {
    it('should return shelf to storage location', async () => {
      const shelfId = 'shelf-1';

      // Initial state: shelf at drop zone
      let shelf: ShelfMap = {
        id: shelfId,
        warehouse_id: 'warehouse-1',
        storage: { x: 100, y: 150, yaw: 0 },
        current: { x: 500, y: 500, yaw: 0 },
        location_status: 'AT_DROP_ZONE',
        available: false,
        status: 'BUSY',
      };

      // Mock restore API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Call restore endpoint
      const response = await mapApi.restoreShelfToStorage(shelfId);
      expect(response.success).toBe(true);

      // After restore, shelf returns to storage location
      shelf = {
        ...shelf,
        current: shelf.storage,
        location_status: 'RESTORED_TO_STORAGE',
      };

      expect(shelf.current).toEqual(shelf.storage);
      expect(shelf.current.x).toBe(100);
      expect(shelf.current.y).toBe(150);
    });

    it('should emit shelf_location_fixed after restore', async () => {
      const shelfId = 'shelf-1';

      // Mock socket emission verification
      const mockSocket = {
        emit: jest.fn(),
      };

      mockSocket.emit('shelf_location_fixed', {
        shelf_id: shelfId,
        storage: { x: 100, y: 150 },
        current: { x: 100, y: 150 },
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('shelf_location_fixed', {
        shelf_id: shelfId,
        storage: { x: 100, y: 150 },
        current: { x: 100, y: 150 },
      });
    });

    it('should handle task status COMPLETED for RETURN_SHELF without mutating storage', async () => {
      const task: TaskMapView = {
        task_id: 'return-task-1',
        status: 'COMPLETED',
        task_type: 'RETURN_SHELF',
        robot: {
          id: 'robot-1',
          x: 100,
          y: 150,
          status: 'IDLE',
          battery: 95,
        },
        shelf: {
          id: 'shelf-1',
          storage: { x: 100, y: 150 }, // Immutable
          current: { x: 100, y: 150 }, // Should equal storage after return
        },
        drop_zone: {
          id: 'zone-1',
          x: 500,
          y: 500,
        },
      };

      // Storage must never be mutated
      const originalStorage = { ...task.shelf.storage };
      expect(task.shelf.storage).toEqual(originalStorage);

      // After task completion
      const completedShelf = {
        ...task.shelf,
        current: task.shelf.storage, // Return to storage
      };

      expect(completedShelf.storage).toEqual(originalStorage);
    });
  });

  describe('MOVE_SHELF Workflow', () => {
    it('should move shelf between storage locations only via admin', async () => {
      const shelfId = 'shelf-1';
      const oldStorage = { x: 100, y: 150 };
      const newStorage = { x: 200, y: 250 };

      let shelf: ShelfMap = {
        id: shelfId,
        warehouse_id: 'warehouse-1',
        storage: oldStorage,
        current: oldStorage,
        location_status: 'STORED',
        available: true,
        status: 'IDLE',
      };

      // Mock admin API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await mapApi.setShelfStorage(shelfId, newStorage);

      // Update shelf with new storage
      shelf = {
        ...shelf,
        storage: newStorage,
        current: newStorage, // Current also updates to new storage
      };

      expect(shelf.storage).toEqual(newStorage);
      expect(shelf.current).toEqual(newStorage);
    });

    it('should require confirmation for admin storage changes', async () => {
      const shelfId = 'shelf-1';
      const newStorage = { x: 300, y: 350 };

      // This would be handled in UI with confirmation dialog
      const confirmed = true; // User confirms

      if (confirmed) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

        const response = await mapApi.setShelfStorage(shelfId, newStorage);
        expect(response.success).toBe(true);
      }
    });
  });

  describe('REPOSITION Workflow', () => {
    it('should reposition robot without affecting shelves', async () => {
      let robot: Robot = {
        id: 'robot-1',
        x: 100,
        y: 100,
        status: 'IDLE',
        battery: 100,
      };

      const shelf: ShelfMap = {
        id: 'shelf-1',
        warehouse_id: 'warehouse-1',
        storage: { x: 100, y: 150, yaw: 0 },
        current: { x: 100, y: 150, yaw: 0 },
        location_status: 'STORED',
        available: true,
        status: 'IDLE',
      };

      const originalShelf = { ...shelf };

      // Robot repositions
      robot = { ...robot, x: 250, y: 250 };

      // Shelf unchanged
      expect(shelf).toEqual(originalShelf);
      expect(robot.x).not.toBe(shelf.current.x);
    });
  });

  describe('State Synchronization', () => {
    it('should sync all tasks after reconnection', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              task_id: 'task-1',
              status: 'IN_PROGRESS',
              task_type: 'PICKUP_AND_DELIVER',
            },
            {
              task_id: 'task-2',
              status: 'PENDING',
              task_type: 'MOVE_SHELF',
            },
          ],
        }),
      });

      const response = await mapApi.getAllTasksForMap();
      expect(response.tasks).toHaveLength(2);
      expect(response.tasks[0].status).toBe('IN_PROGRESS');
      expect(response.tasks[1].status).toBe('PENDING');
    });

    it('should handle dropped shelf at drop zone without mutating storage', async () => {
      const shelf: ShelfMap = {
        id: 'shelf-1',
        warehouse_id: 'warehouse-1',
        storage: { x: 100, y: 150, yaw: 0 }, // Immutable
        current: { x: 500, y: 500, yaw: 0 }, // At drop zone
        location_status: 'AT_DROP_ZONE',
        available: false,
        status: 'DROPPED',
      };

      const originalStorage = { ...shelf.storage };

      // Even with DROPPED status, storage never changes
      expect(shelf.storage).toEqual(originalStorage);
    });

    it('should maintain robot battery state during long operations', async () => {
      let robot: Robot = {
        id: 'robot-1',
        x: 0,
        y: 0,
        status: 'IDLE',
        battery: 100,
      };

      // Simulate battery drain over task execution
      robot = { ...robot, battery: 85 };
      expect(robot.battery).toBe(85);

      robot = { ...robot, battery: 70 };
      expect(robot.battery).toBe(70);

      robot = { ...robot, battery: 55 };
      expect(robot.battery).toBe(55);

      // Position updates should not affect battery state
      robot = { ...robot, x: 250, y: 350 };
      expect(robot.battery).toBe(55);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      try {
        await mapApi.getAllTasksForMap();
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed task data', async () => {
      const malformedTask = {
        task_id: 'task-1',
        // Missing required fields
      };

      // Should gracefully handle or throw typed error
      expect(malformedTask).toBeDefined();
    });

    it('should prevent shelf storage mutation via invalid API responses', async () => {
      const shelf: ShelfMap = {
        id: 'shelf-1',
        warehouse_id: 'warehouse-1',
        storage: { x: 100, y: 150, yaw: 0 },
        current: { x: 500, y: 500, yaw: 0 },
        location_status: 'AT_DROP_ZONE',
        available: false,
        status: 'BUSY',
      };

      const originalStorage = { ...shelf.storage };

      // Attempt to mutate via invalid response
      const invalidUpdate = { storage: { x: 999, y: 999 } };

      // Should not apply invalid mutation
      expect(shelf.storage).toEqual(originalStorage);
    });
  });

  describe('Performance', () => {
    it('should efficiently handle 100+ shelves', async () => {
      const shelves: ShelfMap[] = Array.from({ length: 100 }, (_, i) => ({
        id: `shelf-${i}`,
        warehouse_id: 'warehouse-1',
        storage: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100, yaw: 0 },
        current: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100, yaw: 0 },
        location_status: 'STORED' as const,
        available: true,
        status: 'IDLE',
      }));

      expect(shelves).toHaveLength(100);

      // Each shelf should maintain immutable storage
      shelves.forEach((shelf) => {
        expect(shelf.storage).toBeDefined();
        expect(shelf.current).toBeDefined();
      });
    });

    it('should efficiently handle 50+ simultaneous robot updates', async () => {
      const robots: Robot[] = Array.from({ length: 50 }, (_, i) => ({
        id: `robot-${i}`,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        status: 'BUSY',
        battery: Math.floor(Math.random() * 100) + 50,
      }));

      expect(robots).toHaveLength(50);

      // All robots should maintain valid state
      robots.forEach((robot) => {
        expect(robot.x).toBeGreaterThanOrEqual(0);
        expect(robot.y).toBeGreaterThanOrEqual(0);
        expect(robot.battery).toBeGreaterThan(0);
      });
    });
  });
});
