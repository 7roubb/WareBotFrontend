/**
 * Global context for map state management
 * Stores tasks, robots, and shelves with mutable current positions
 */
import React, { createContext, useContext, useCallback, useState } from 'react';
import {
  TaskMapView,
  Robot,
  ShelfMap,
  Coordinates,
} from '../types/map';

interface MapContextType {
  tasks: Map<string, TaskMapView>;
  shelves: Map<string, ShelfMap>;
  robots: Map<string, Robot>;

  // Task operations
  setTask: (task: TaskMapView) => void;
  removeTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: string) => void;
  getTask: (taskId: string) => TaskMapView | undefined;

  // Shelf operations
  setShelf: (shelf: ShelfMap) => void;
  removeShelf: (shelfId: string) => void;
  setShelfCurrent: (shelfId: string, x: number, y: number, locationStatus: string) => void;
  markShelfFixed: (shelfId: string) => void;
  getShelf: (shelfId: string) => ShelfMap | undefined;

  // Robot operations
  setRobot: (robot: Robot) => void;
  removeRobot: (robotId: string) => void;
  setRobotPosition: (robotId: string, x: number, y: number) => void;
  getRobot: (robotId: string) => Robot | undefined;

  // Bulk operations
  setTasks: (tasks: TaskMapView[]) => void;
  setShelves: (shelves: ShelfMap[]) => void;
  setRobots: (robots: Robot[]) => void;

  // Clear all
  clear: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasksState] = useState<Map<string, TaskMapView>>(new Map());
  const [shelves, setShelvesState] = useState<Map<string, ShelfMap>>(new Map());
  const [robots, setRobotsState] = useState<Map<string, Robot>>(new Map());

  const setTask = useCallback((task: TaskMapView) => {
    setTasksState((prev) => new Map(prev).set(task.task_id, task));
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasksState((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  const updateTaskStatus = useCallback((taskId: string, status: string) => {
    setTasksState((prev) => {
      const task = prev.get(taskId);
      if (!task) return prev;
      const next = new Map(prev);
      next.set(taskId, { ...task, status });
      return next;
    });
  }, []);

  const getTask = useCallback((taskId: string) => {
    return tasks.get(taskId);
  }, [tasks]);

  const setShelf = useCallback((shelf: ShelfMap) => {
    setShelvesState((prev) => new Map(prev).set(shelf.id, shelf));
  }, []);

  const removeShelf = useCallback((shelfId: string) => {
    setShelvesState((prev) => {
      const next = new Map(prev);
      next.delete(shelfId);
      return next;
    });
  }, []);

  /**
   * Update shelf's current location (mutable)
   * Storage location is never changed by this function
   */
  const setShelfCurrent = useCallback(
    (shelfId: string, x: number, y: number, locationStatus: string) => {
      setShelvesState((prev) => {
        const shelf = prev.get(shelfId);
        if (!shelf) return prev;
        const next = new Map(prev);
        next.set(shelfId, {
          ...shelf,
          current: { x, y, yaw: shelf.current?.yaw },
          location_status: locationStatus as any,
        });
        return next;
      });
    },
    []
  );

  /**
   * Mark shelf as fixed (immutable storage location)
   * Visually annotate that storage coords cannot be changed
   */
  const markShelfFixed = useCallback((shelfId: string) => {
    setShelvesState((prev) => {
      const shelf = prev.get(shelfId);
      if (!shelf) return prev;
      const next = new Map(prev);
      next.set(shelfId, { ...shelf, status: 'IDLE' }); // Mark as fixed visually
      return next;
    });
  }, []);

  const getShelf = useCallback((shelfId: string) => {
    return shelves.get(shelfId);
  }, [shelves]);

  const setRobot = useCallback((robot: Robot) => {
    setRobotsState((prev) => new Map(prev).set(robot.id, robot));
  }, []);

  const removeRobot = useCallback((robotId: string) => {
    setRobotsState((prev) => {
      const next = new Map(prev);
      next.delete(robotId);
      return next;
    });
  }, []);

  const setRobotPosition = useCallback((robotId: string, x: number, y: number) => {
    setRobotsState((prev) => {
      const robot = prev.get(robotId);
      if (!robot) return prev;
      const next = new Map(prev);
      next.set(robotId, { ...robot, x, y });
      return next;
    });
  }, []);

  const getRobot = useCallback((robotId: string) => {
    return robots.get(robotId);
  }, [robots]);

  const setTasks = useCallback((newTasks: TaskMapView[]) => {
    const map = new Map<string, TaskMapView>();
    newTasks.forEach((task) => map.set(task.task_id, task));
    setTasksState(map);
  }, []);

  const setShelves = useCallback((newShelves: ShelfMap[]) => {
    const map = new Map<string, ShelfMap>();
    newShelves.forEach((shelf) => map.set(shelf.id, shelf));
    setShelvesState(map);
  }, []);

  const setRobots = useCallback((newRobots: Robot[]) => {
    const map = new Map<string, Robot>();
    newRobots.forEach((robot) => map.set(robot.id, robot));
    setRobotsState(map);
  }, []);

  const clear = useCallback(() => {
    setTasksState(new Map());
    setShelvesState(new Map());
    setRobotsState(new Map());
  }, []);

  const value: MapContextType = {
    tasks,
    shelves,
    robots,
    setTask,
    removeTask,
    updateTaskStatus,
    getTask,
    setShelf,
    removeShelf,
    setShelfCurrent,
    markShelfFixed,
    getShelf,
    setRobot,
    removeRobot,
    setRobotPosition,
    getRobot,
    setTasks,
    setShelves,
    setRobots,
    clear,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within MapProvider');
  }
  return context;
}
