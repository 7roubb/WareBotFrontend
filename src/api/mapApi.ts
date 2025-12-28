/**
 * API client for real-time map and task management
 */
import { TaskMapView, ShelfMap, Coordinates } from '../types/map';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

class MapApi {
  /**
   * Fetch all tasks in map view format (real-time)
   */
  async getAllTasksForMap(): Promise<TaskMapView[]> {
    const res = await fetch(`${API_BASE}/tasks/realtime/map/all`);
    if (!res.ok) throw new Error(`Failed to fetch tasks map: ${res.statusText}`);
    const data = await res.json();
    return data.tasks || data;
  }

  /**
   * Fetch a single task in map view format
   */
  async getTaskForMap(taskId: string): Promise<TaskMapView> {
    const res = await fetch(`${API_BASE}/tasks/realtime/${taskId}`);
    if (!res.ok) throw new Error(`Failed to fetch task: ${res.statusText}`);
    const data = await res.json();
    return data.task || data;
  }

  /**
   * Fetch shelf details with both storage and current locations
   */
  async getShelf(shelfId: string): Promise<ShelfMap> {
    const res = await fetch(`${API_BASE}/shelves/${shelfId}`);
    if (!res.ok) throw new Error(`Failed to fetch shelf: ${res.statusText}`);
    return res.json();
  }

  /**
   * Restore a shelf to its storage location
   * This is called after a RETURN_SHELF task completes
   */
  async restoreShelfToStorage(shelfId: string): Promise<ShelfMap> {
    const res = await fetch(`${API_BASE}/shelves/${shelfId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to restore shelf: ${res.statusText}`);
    return res.json();
  }

  /**
   * Admin: Set shelf storage location (permanent)
   * Requires admin privileges
   */
  async setShelfStorage(
    shelfId: string,
    coordinates: { storage_x: number; storage_y: number; storage_yaw?: number }
  ): Promise<ShelfMap> {
    const res = await fetch(`${API_BASE}/shelves/${shelfId}/storage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordinates),
    });
    if (res.status === 403) {
      throw new Error('Forbidden: Admin privileges required');
    }
    if (!res.ok) throw new Error(`Failed to set shelf storage: ${res.statusText}`);
    return res.json();
  }

  /**
   * Get shelf current location (mutable)
   */
  async getShelfCurrentLocation(shelfId: string): Promise<Coordinates & { status: string }> {
    const shelf = await this.getShelf(shelfId);
    return {
      x: shelf.current.x,
      y: shelf.current.y,
      yaw: shelf.current.yaw,
      status: shelf.location_status,
    };
  }

  /**
   * Get all shelves with map view format
   */
  async getAllShelves(): Promise<ShelfMap[]> {
    const res = await fetch(`${API_BASE}/shelves`);
    if (!res.ok) throw new Error(`Failed to fetch shelves: ${res.statusText}`);
    const data = await res.json();
    return data.shelves || data.results || data;
  }
}

export const mapApi = new MapApi();
