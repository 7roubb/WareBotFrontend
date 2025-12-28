/**
 * Real-time map view types for task management system
 * These match the backend's map view format
 */

export interface Coordinates {
  x: number;
  y: number;
  yaw?: number;
}

export interface Robot {
  id: string;
  x: number;
  y: number;
  status?: 'IDLE' | 'CHARGING' | 'BUSY' | 'OFFLINE';
  battery?: number;
  timestamp?: number;
}

export interface ShelfLocation {
  storage: Coordinates;
  current: Coordinates;
  location_status: 'STORED' | 'IN_TRANSIT' | 'AT_DROP_ZONE' | 'DELIVERED_AT_DROP_ZONE' | 'RESTORED_TO_STORAGE';
}

export interface ShelfMap {
  id: string;
  warehouse_id: string;
  storage: Coordinates;
  current: Coordinates;
  location_status: 'STORED' | 'IN_TRANSIT' | 'AT_DROP_ZONE' | 'DELIVERED_AT_DROP_ZONE' | 'RESTORED_TO_STORAGE';
  available: boolean;
  status: 'IDLE' | 'BUSY';
}

export interface DropZone {
  id: string;
  x: number;
  y: number;
  name?: string;
}

export interface TaskMapView {
  task_id: string;
  status: string;
  task_type: 'PICKUP_AND_DELIVER' | 'MOVE_SHELF' | 'RETURN_SHELF' | 'REPOSITION';
  robot: Robot;
  shelf: {
    id: string;
    storage: Coordinates;
    current: Coordinates;
  };
  drop_zone?: {
    id: string;
    x: number;
    y: number;
  };
  priority?: number;
  created_at?: string;
  updated_at?: string;
}

// WebSocket Event Payloads
export interface RobotPositionPayload {
  task_id: string;
  robot: Robot;
  status?: string;
}

export interface TaskStatusChangePayload {
  task_id: string;
  old_status?: string;
  new_status: string;
  robot?: Robot;
  shelf?: {
    id: string;
    storage: Coordinates;
    current: Coordinates;
  };
  drop_zone?: DropZone;
  timestamp?: number;
}

export interface ShelfLocationFixedPayload {
  task_id: string;
  shelf_id: string;
  x: number;
  y: number;
  yaw?: number;
  location_status: string;
}

export interface MapDataPayload {
  tasks: TaskMapView[];
  robots?: Robot[];
  shelves?: ShelfMap[];
  timestamp?: number;
}

export interface TaskUpdatePayload {
  task: TaskMapView;
}

export interface AllTasksMapUpdatePayload {
  tasks: TaskMapView[];
  timestamp?: number;
}
