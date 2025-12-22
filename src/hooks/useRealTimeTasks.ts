/**
 * React hook for real-time task state management
 * Handles live task updates, robot positions, and shelf locations
 */

import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import {
  connectTaskWebSocket,
  subscribeToTask,
  unsubscribeFromTask,
  subscribeToMapUpdates,
  onTaskWebSocketEvent,
  requestTaskData,
  requestMapData,
  getTaskWebSocketState,
} from '../services/taskWebsocket';

export interface TaskState {
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

export interface MapViewState {
  tasks: TaskState[];
  lastUpdate: string;
  taskCount: number;
}

type TaskAction =
  | { type: 'SET_TASK'; payload: TaskState }
  | { type: 'UPDATE_ROBOT_POSITION'; payload: { task_id: string; robot: { x: number; y: number }; status: string } }
  | { type: 'UPDATE_STATUS'; payload: { task_id: string; old_status: string; new_status: string; current_target?: string } }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'SET_TASKS'; payload: TaskState[] }
  | { type: 'CLEAR' };

// Task reducer for state management
const taskReducer = (state: Record<string, TaskState>, action: TaskAction): Record<string, TaskState> => {
  switch (action.type) {
    case 'SET_TASK': {
      const task = action.payload;
      return {
        ...state,
        [task.task_id]: task,
      };
    }
    case 'UPDATE_ROBOT_POSITION': {
      const { task_id, robot, status } = action.payload;
      if (!state[task_id]) return state;
      return {
        ...state,
        [task_id]: {
          ...state[task_id],
          robot,
          status,
          last_updated: new Date().toISOString(),
        },
      };
    }
    case 'UPDATE_STATUS': {
      const { task_id, new_status, current_target } = action.payload;
      if (!state[task_id]) return state;
      return {
        ...state,
        [task_id]: {
          ...state[task_id],
          status: new_status,
          current_target,
          last_updated: new Date().toISOString(),
        },
      };
    }
    case 'REMOVE_TASK': {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.payload]: _removed, ...rest } = state;
      return rest;
    }
    case 'SET_TASKS': {
      const newState: Record<string, TaskState> = {};
      action.payload.forEach((task) => {
        newState[task.task_id] = task;
      });
      return newState;
    }
    case 'CLEAR':
      return {};
    default:
      return state;
  }
};

export const useRealTimeTasks = () => {
  const [tasks, dispatch] = useReducer(taskReducer, {});
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const subscribedTasksRef = useRef<Set<string>>(new Set());
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    const setupConnection = async () => {
      try {
        const socket = connectTaskWebSocket();
        if (socket?.connected) {
          setWsConnected(true);
          setWsError(null);
        }
        setIsInitializing(false);
      } catch (error) {
        console.error('[useRealTimeTasks] Failed to connect:', error);
        setWsError('Failed to establish WebSocket connection');
        setIsInitializing(false);
      }
    };

    setupConnection();

    // Register connection handlers
    const unsubConnect = onTaskWebSocketEvent('connect', () => {
      console.log('[useRealTimeTasks] WebSocket connected');
      setWsConnected(true);
      setWsError(null);
    });

    const unsubDisconnect = onTaskWebSocketEvent('disconnect', (data: unknown) => {
      console.log('[useRealTimeTasks] WebSocket disconnected:', (data as Record<string, unknown>)?.reason);
      setWsConnected(false);
    });

    const unsubError = onTaskWebSocketEvent('error', (error: unknown) => {
      console.warn('[useRealTimeTasks] WebSocket error:', error);
      setWsError((error as Record<string, unknown>)?.message ? String((error as Record<string, unknown>).message) : 'WebSocket error occurred');
    });

    unsubscribersRef.current.push(unsubConnect, unsubDisconnect, unsubError);

    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // Subscribe to specific task updates
  const subscribeToTaskUpdates = useCallback(
    (taskId: string) => {
      if (subscribedTasksRef.current.has(taskId)) {
        console.log('[useRealTimeTasks] Already subscribed to task:', taskId);
        return;
      }

      if (!wsConnected) {
        console.warn('[useRealTimeTasks] WebSocket not connected, cannot subscribe');
        return;
      }

      console.log('[useRealTimeTasks] Subscribing to task updates:', taskId);
      subscribeToTask(taskId);
      subscribedTasksRef.current.add(taskId);

      // Register update handlers
      const unsubRobotPos = onTaskWebSocketEvent('robot_position_update', (data: unknown) => {
        const typedData = data as Record<string, unknown>;
        if (typedData.task_id === taskId) {
          dispatch({
            type: 'UPDATE_ROBOT_POSITION',
            payload: {
              task_id: taskId,
              robot: typedData.robot,
              status: typedData.status,
            },
          });
        }
      });

      const unsubStatusChange = onTaskWebSocketEvent('task_status_change', (data: unknown) => {
        const typedData = data as Record<string, unknown>;
        if (typedData.task_id === taskId) {
          dispatch({
            type: 'UPDATE_STATUS',
            payload: {
              task_id: taskId,
              old_status: typedData.old_status,
              new_status: typedData.new_status,
              current_target: typedData.current_target,
            },
          });
        }
      });

      unsubscribersRef.current.push(unsubRobotPos, unsubStatusChange);
    },
    [wsConnected]
  );

  // Unsubscribe from specific task updates
  const unsubscribeFromTaskUpdates = useCallback(
    (taskId: string) => {
      if (!subscribedTasksRef.current.has(taskId)) {
        return;
      }

      console.log('[useRealTimeTasks] Unsubscribing from task updates:', taskId);
      unsubscribeFromTask(taskId);
      subscribedTasksRef.current.delete(taskId);
      dispatch({ type: 'REMOVE_TASK', payload: taskId });
    },
    []
  );

  // Subscribe to all map updates
  const subscribeToAllMapUpdates = useCallback(() => {
    if (!wsConnected) {
      console.warn('[useRealTimeTasks] WebSocket not connected, cannot subscribe to map');
      return;
    }

    console.log('[useRealTimeTasks] Subscribing to all map updates');
    subscribeToMapUpdates();

    // Register map update handler
    const unsubMapUpdate = onTaskWebSocketEvent('all_tasks_map_update', (data: unknown) => {
      const typedData = data as Record<string, unknown>;
      const tasks = Array.isArray(typedData.tasks) ? typedData.tasks : [];
      console.log('[useRealTimeTasks] Received all tasks map update:', tasks.length, 'tasks');
      dispatch({ type: 'SET_TASKS', payload: tasks });
    });

    unsubscribersRef.current.push(unsubMapUpdate);
  }, [wsConnected]);

  // Request task data on demand
  const fetchTaskData = useCallback((taskId: string) => {
    if (!wsConnected) {
      console.warn('[useRealTimeTasks] WebSocket not connected, cannot request task data');
      return;
    }

    console.log('[useRealTimeTasks] Requesting task data:', taskId);
    requestTaskData(taskId);

    // Register task data handler
    const unsubTaskData = onTaskWebSocketEvent('task_data', (data: unknown) => {
      const typedData = data as Record<string, unknown>;
      const task = typedData.task as Record<string, unknown>;
      if (task?.task_id === taskId) {
        dispatch({
          type: 'SET_TASK',
          payload: task,
        });
      }
    });

    unsubscribersRef.current.push(unsubTaskData);
  }, [wsConnected]);

  // Request all map data on demand
  const fetchAllMapData = useCallback(() => {
    if (!wsConnected) {
      console.warn('[useRealTimeTasks] WebSocket not connected, cannot request map data');
      return;
    }

    console.log('[useRealTimeTasks] Requesting all map data');
    requestMapData();

    // Register map data handler
    const unsubMapData = onTaskWebSocketEvent('map_data', (data: unknown) => {
      const typedData = data as Record<string, unknown>;
      const tasks = Array.isArray(typedData.tasks) ? typedData.tasks : [];
      console.log('[useRealTimeTasks] Received map data:', tasks.length, 'tasks');
      dispatch({ type: 'SET_TASKS', payload: tasks });
    });

    unsubscribersRef.current.push(unsubMapData);
  }, [wsConnected]);

  // Get task by ID
  const getTask = useCallback(
    (taskId: string): TaskState | undefined => {
      return tasks[taskId];
    },
    [tasks]
  );

  // Get all tasks
  const getAllTasks = useCallback((): TaskState[] => {
    return Object.values(tasks);
  }, [tasks]);

  // Get active tasks
  const getActiveTasks = useCallback((): TaskState[] => {
    return Object.values(tasks).filter(
      (task) =>
        task.status &&
        ['PENDING', 'ASSIGNED', 'MOVING_TO_SHELF', 'PICKING', 'MOVING_TO_DROP', 'DROPPING', 'RETURNING'].includes(
          task.status
        )
    );
  }, [tasks]);

  // Get WebSocket connection state
  const getWsState = useCallback(() => {
    return getTaskWebSocketState();
  }, []);

  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      subscribedTasksRef.current.forEach((taskId) => {
        unsubscribeFromTask(taskId);
      });
      unsubscribersRef.current.forEach((unsub) => unsub());
    };
  }, []);

  return {
    // State
    tasks,
    taskList: getAllTasks(),
    activeTasks: getActiveTasks(),
    wsConnected,
    wsError,
    isInitializing,

    // Methods
    subscribeToTask: subscribeToTaskUpdates,
    unsubscribeFromTask: unsubscribeFromTaskUpdates,
    subscribeToMapUpdates: subscribeToAllMapUpdates,
    fetchTaskData,
    fetchAllMapData,
    getTask,
    getAllTasks,
    getActiveTasks,
    getWsState,
  };
};

/**
 * Hook for map view state management (all tasks)
 */
export const useMapView = () => {
  const [mapState, setMapState] = useState<MapViewState>({
    tasks: [],
    lastUpdate: new Date().toISOString(),
    taskCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Use the realtime tasks hook
  const { taskList, wsConnected, subscribeToMapUpdates, fetchAllMapData } = useRealTimeTasks();

  // Update map state when tasks change
  useEffect(() => {
    setMapState((prev) => ({
      ...prev,
      tasks: taskList,
      taskCount: taskList.length,
      lastUpdate: new Date().toISOString(),
    }));
    setIsLoading(false);
  }, [taskList]);

  // Initialize map subscriptions
  useEffect(() => {
    if (wsConnected) {
      console.log('[useMapView] Initializing map view subscriptions');
      subscribeToMapUpdates();
      fetchAllMapData();
    }
  }, [wsConnected, subscribeToMapUpdates, fetchAllMapData]);

  return {
    ...mapState,
    isLoading,
    wsConnected,
  };
};
