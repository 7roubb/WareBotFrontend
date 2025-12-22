/**
 * Real-time task API service
 * Handles REST API calls for task position and status updates
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface UpdateRobotPositionPayload {
  robot_x: number;
  robot_y: number;
  status: string;
}

export interface UpdateTaskStatusPayload {
  old_status: string;
  new_status: string;
  current_target?: string;
  robot_x?: number;
  robot_y?: number;
}

export interface TaskMapData {
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
  };
  drop_zone?: {
    id: string;
    x: number;
    y: number;
  };
  phase?: string;
  current_target?: string;
  created_at?: string;
  started_at?: string;
  last_updated?: string;
}

class TaskRealtimeService {
  /**
   * Update robot position for a task
   */
  async updateRobotPosition(
    taskId: string,
    payload: UpdateRobotPositionPayload
  ): Promise<{ success: boolean; task_id: string; robot: { x: number; y: number }; status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE}/tasks/realtime/${taskId}/position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to update robot position: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, payload: UpdateTaskStatusPayload): Promise<any> {
    const response = await fetch(`${API_BASE}/tasks/realtime/${taskId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get task data for map display
   */
  async getTaskForMap(taskId: string): Promise<{ task: TaskMapData; timestamp: string }> {
    const response = await fetch(`${API_BASE}/tasks/realtime/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get task: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all active tasks for map display
   */
  async getAllTasksForMap(): Promise<{
    tasks: TaskMapData[];
    count: number;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE}/tasks/realtime/map/all`, {
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get all tasks: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all active tasks for a specific robot
   */
  async getRobotTasksForMap(robotId: string): Promise<{
    robot_id: string;
    tasks: TaskMapData[];
    count: number;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE}/tasks/realtime/map/robot/${robotId}`, {
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get robot tasks: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Trigger a broadcast of all active tasks map data
   */
  async broadcastMapUpdate(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE}/tasks/realtime/broadcast-map-update`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to broadcast map update: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string {
    return localStorage.getItem('access_token') || localStorage.getItem('token') || '';
  }
}

export const taskRealtimeService = new TaskRealtimeService();
export default taskRealtimeService;
