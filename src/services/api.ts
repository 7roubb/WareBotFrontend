// API Configuration - Set VITE_API_URL in .env or use proxy
const API_URL = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
const DEBUG_MODE = import.meta.env.DEV;

import type {
  Task,
  TaskCreate,
  TaskStatus,
  TaskType,
} from '@/types'; 

let token: string | null = localStorage.getItem('token');

export const setToken = (newToken: string | null) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('token', newToken);
  } else {
    localStorage.removeItem('token');
  }
};

export const getToken = () => token || localStorage.getItem('token');

const getHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const currentToken = getToken();
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  return headers;
};

// Handle API responses with proper error handling
const handleResponse = async (res: Response, endpoint: string) => {
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    let errorMessage = `API Error: ${res.status} ${res.statusText}`;

    try {
      if (contentType?.includes('application/json')) {
        const error = await res.json();
        errorMessage = error.message || error.error || errorMessage;
      }
    } catch (e) {
      // Response parsing failed
    }

    if (DEBUG_MODE) {
      console.error(`[API] Failed: ${endpoint}`, { status: res.status, message: errorMessage });
    }

    throw new Error(errorMessage);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return {};
  }

  return res.json();
};

// Sanitize MongoDB documents: convert _id to id and ensure numeric fields
const sanitizeDoc = (doc: any) => {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  
  if (out._id) {
    out.id = String(out._id);
    delete out._id;
  }

  const numericKeys = ['x', 'y', 'yaw', 'current_x', 'current_y', 'current_yaw', 'target_x', 'target_y', 'priority', 'storage_x', 'storage_y', 'storage_yaw'];
  for (const k of numericKeys) {
    if (out[k] !== undefined && out[k] !== null) {
      const n = Number(out[k]);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }

  return out;
};

const sanitizeDocs = (docs: any[]): any[] => {
  if (!Array.isArray(docs)) return docs;
  return docs.map(sanitizeDoc);
};

// Auth endpoints
export const auth = {
  register: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res, '/auth/register-admin');
  },

  login: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleResponse(res, '/auth/login');
    if (data.access_token) {
      setToken(data.access_token);
    }
    return data;
  },

  logout: () => {
    setToken(null);
  },
};

// Health check
export const health = {
  check: async () => {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return { status: 'ok', data: await res.json() };
      }
      return { status: 'error', code: res.status };
    } catch (error: any) {
      return { status: 'error', message: error.message, apiUrl: API_URL };
    }
  },
};

// Products API
export const products = {
  list: async () => {
    const res = await fetch(`${API_URL}/products`);
    const data = await handleResponse(res, '/products');
    return sanitizeDocs(Array.isArray(data) ? data : data.results || []);
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/products/${id}`);
    return sanitizeDoc(await handleResponse(res, `/products/${id}`));
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, '/products'));
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, `/products/${id}`));
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/products/${id}`);
  },

  search: async (q: string) => {
    if (!q?.trim()) return [];
    const res = await fetch(`${API_URL}/products/search?q=${encodeURIComponent(q)}`);
    const data = await handleResponse(res, '/products/search');
    return sanitizeDocs(Array.isArray(data) ? data : []);
  },

  pickStock: async (productId: string, quantity: number, description?: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/pick`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ quantity, description }),
    });
    return handleResponse(res, `/products/${productId}/pick`);
  },

  returnStock: async (productId: string, quantity: number, description?: string) => {
    const res = await fetch(`${API_URL}/products/return`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, quantity, description }),
    });
    return handleResponse(res, '/products/return');
  },

  adjustStock: async (productId: string, newQuantity: number, reason?: string) => {
    const res = await fetch(`${API_URL}/products/adjust`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, new_quantity: newQuantity, reason }),
    });
    return handleResponse(res, '/products/adjust');
  },

  getTransactions: async (productId: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/transactions`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, `/products/${productId}/transactions`);
    return sanitizeDocs(Array.isArray(data) ? data : data.transactions || []);
  },

  uploadImage: async (productId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_URL}/products/${productId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    return handleResponse(res, `/products/${productId}/images`);
  },

  deleteImage: async (productId: string, index: number) => {
    const res = await fetch(`${API_URL}/products/${productId}/images/${index}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/products/${productId}/images/${index}`);
  },

  setMainImage: async (productId: string, imageUrl: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/images/set-main`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ image_url: imageUrl }),
    });
    return handleResponse(res, `/products/${productId}/images/set-main`);
  },

  getImages: async (productId: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/images`);
    const data = await handleResponse(res, `/products/${productId}/images`);
    return Array.isArray(data) ? data : data.images || [];
  },
};

// Robots API
export const robots = {
  list: async () => {
    const res = await fetch(`${API_URL}/robots`);
    const data = await handleResponse(res, '/robots');
    return sanitizeDocs(Array.isArray(data) ? data : data.results || []);
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`);
    return sanitizeDoc(await handleResponse(res, `/robots/${id}`));
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/robots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, '/robots'));
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, `/robots/${id}`));
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/robots/${id}`);
  },
};
import type {
  Shelf,
  ShelfCreate,
  ShelfUpdate,
  UpdateLocationInput,
  SetStorageLocationInput,
  ShelfLocationInfo,
  LocationHistoryEntry,
  Product,
} from '@/types';


// =========================================================
// Shelves API
// =========================================================

export const shelves = {
  // -------------------------------------
  // LIST ALL SHELVES
  // -------------------------------------
  list: async (): Promise<Shelf[]> => {
    const res = await fetch(`${API_URL}/shelves`);
    const data = await handleResponse(res, '/shelves');
    return sanitizeDocs(Array.isArray(data) ? data : data.results || []);
  },

  // -------------------------------------
  // GET SINGLE SHELF
  // -------------------------------------
  get: async (id: string): Promise<Shelf> => {
    const res = await fetch(`${API_URL}/shelves/${id}`);
    return sanitizeDoc(await handleResponse(res, `/shelves/${id}`));
  },

  // -------------------------------------
  // CREATE SHELF
  // -------------------------------------
  create: async (data: ShelfCreate): Promise<Shelf> => {
    // Validate required fields
    if (!data.warehouse_id || data.warehouse_id.trim() === '') {
      throw new Error('warehouse_id is required');
    }

    if (data.current_x === undefined || isNaN(data.current_x)) {
      throw new Error('current_x must be a valid number');
    }

    if (data.current_y === undefined || isNaN(data.current_y)) {
      throw new Error('current_y must be a valid number');
    }

    if (data.level === undefined || data.level < 0) {
      throw new Error('level must be a non-negative number');
    }

    const payload: any = {
      warehouse_id: String(data.warehouse_id).trim(),
      current_x: Number(data.current_x),
      current_y: Number(data.current_y),
      current_yaw: data.current_yaw !== undefined ? Number(data.current_yaw) : 0.0,
      level: Number(Math.floor(data.level)),
      available: data.available !== undefined ? Boolean(data.available) : true,
      status: data.status ? String(data.status).trim() : 'IDLE',
    };

    // Optional storage location
    if (data.storage_x !== undefined && data.storage_y !== undefined) {
      payload.storage_x = Number(data.storage_x);
      payload.storage_y = Number(data.storage_y);
      payload.storage_yaw = data.storage_yaw !== undefined ? Number(data.storage_yaw) : 0.0;
    }

    console.log('[Shelves API] Creating shelf with payload:', payload);

    const res = await fetch(`${API_URL}/shelves`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to create shelf');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // UPDATE SHELF (NON-LOCATION FIELDS)
  // -------------------------------------
  update: async (id: string, data: ShelfUpdate): Promise<Shelf> => {
    const payload: any = {};

    if (data.warehouse_id !== undefined) {
      payload.warehouse_id = String(data.warehouse_id).trim();
    }
    if (data.level !== undefined) {
      payload.level = Number(Math.floor(data.level));
    }
    if (data.available !== undefined) {
      payload.available = Boolean(data.available);
    }
    if (data.status !== undefined) {
      payload.status = String(data.status).trim();
    }

    console.log('[Shelves API] Updating shelf with payload:', payload);

    const res = await fetch(`${API_URL}/shelves/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to update shelf');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // UPDATE CURRENT LOCATION (LIVE/REAL-TIME)
  // Used by robots to report their current position
  // -------------------------------------
  updateLocation: async (
    id: string,
    location: UpdateLocationInput
  ): Promise<Shelf> => {
    // Validate required fields
    if (location.current_x === undefined || isNaN(location.current_x)) {
      throw new Error('current_x is required and must be a valid number');
    }

    if (location.current_y === undefined || isNaN(location.current_y)) {
      throw new Error('current_y is required and must be a valid number');
    }

    const payload: any = {
      current_x: Number(location.current_x),
      current_y: Number(location.current_y),
    };

    if (location.current_yaw !== undefined) {
      payload.current_yaw = Number(location.current_yaw);
    }

    console.log('[Shelves API] Updating location for shelf', id, ':', payload);

    const res = await fetch(`${API_URL}/shelves/${id}/location`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to update location');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // RESTORE SHELF TO STORAGE LOCATION
  // Moves shelf from current position back to storage (home) position
  // Used for RETURN_SHELF task completion
  // -------------------------------------
  restoreToStorage: async (id: string): Promise<any> => {
    console.log('[Shelves API] Restoring shelf', id, 'to storage location');

    const res = await fetch(`${API_URL}/shelves/${id}/restore-location`, {
      method: 'PUT',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to restore shelf');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return responseData;
  },

  // Alias for restoreToStorage (POST variant)
  restore: async (id: string): Promise<any> => {
    console.log('[Shelves API] Restoring shelf', id, '(POST variant)');

    const res = await fetch(`${API_URL}/shelves/${id}/restore`, {
      method: 'POST',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to restore shelf');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return responseData;
  },

  // Update shelf current location (for manual corrections or task updates)
  updateCurrentLocation: async (
    id: string,
    location: {
      current_x: number;
      current_y: number;
      current_yaw?: number;
    }
  ): Promise<Shelf> => {
    if (location.current_x === undefined || isNaN(location.current_x)) {
      throw new Error('current_x is required and must be a valid number');
    }

    if (location.current_y === undefined || isNaN(location.current_y)) {
      throw new Error('current_y is required and must be a valid number');
    }

    const payload: any = {
      current_x: Number(location.current_x),
      current_y: Number(location.current_y),
    };

    if (location.current_yaw !== undefined) {
      payload.current_yaw = Number(location.current_yaw);
    }

    console.log('[Shelves API] Updating current location for shelf', id, ':', payload);

    const res = await fetch(`${API_URL}/shelves/${id}/location`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to update location');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // ADMIN: SET STORAGE LOCATION
  // Allows admin to override the storage (home) location for a shelf
  // Used for manual corrections or rebalancing
  // -------------------------------------
  setStorageLocation: async (
    id: string,
    storage: SetStorageLocationInput
  ): Promise<any> => {
    if (storage.storage_x === undefined || isNaN(storage.storage_x)) {
      throw new Error('storage_x is required and must be a valid number');
    }

    if (storage.storage_y === undefined || isNaN(storage.storage_y)) {
      throw new Error('storage_y is required and must be a valid number');
    }

    const payload: any = {
      storage_x: Number(storage.storage_x),
      storage_y: Number(storage.storage_y),
      storage_yaw: storage.storage_yaw !== undefined ? Number(storage.storage_yaw) : 0.0,
    };

    console.log('[Shelves API] Setting storage location for shelf', id, ':', payload);

    const res = await fetch(`${API_URL}/shelves/${id}/storage`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to set storage location');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return responseData;
  },

  // -------------------------------------
  // GET LOCATION INFO
  // Returns both current and storage location info for a shelf
  // -------------------------------------
  getLocationInfo: async (id: string): Promise<ShelfLocationInfo> => {
    const res = await fetch(`${API_URL}/shelves/${id}/location-info`);
    return handleResponse(res, `/shelves/${id}/location-info`);
  },

  // -------------------------------------
  // GET LOCATION HISTORY
  // Returns historical location data for a shelf
  // Useful for tracking movements and paths
  // -------------------------------------
  getLocationHistory: async (
    id: string,
    limit: number = 50
  ): Promise<{ shelf_id: string; history: LocationHistoryEntry[] }> => {
    const res = await fetch(
      `${API_URL}/shelves/${id}/location-history?limit=${limit}`
    );
    return handleResponse(res, `/shelves/${id}/location-history`);
  },

  // -------------------------------------
  // RESTORE SHELF TO STORAGE LOCATION
  // Returns shelf to its immutable storage (home) location
  // Called when RETURN_SHELF task completes or on error recovery
  // -------------------------------------
  restoreToStorageLocation: async (id: string): Promise<Shelf> => {
    console.log('[Shelves API] Restoring shelf', id, 'to storage location');

    const res = await fetch(`${API_URL}/shelves/${id}/restore`, {
      method: 'POST',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to restore shelf');
      error.status = res.status;
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // DELETE SHELF (SOFT DELETE)
  // Marks shelf as deleted (doesn't actually remove from DB)
  // -------------------------------------
  delete: async (id: string): Promise<any> => {
    console.log('[Shelves API] Deleting shelf', id);

    const res = await fetch(`${API_URL}/shelves/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to delete shelf');
      error.status = res.status;
      throw error;
    }

    return responseData;
  },

  // -------------------------------------
  // GET PRODUCTS ON SHELF
  // Returns all products stored on this shelf
  // -------------------------------------
  getProducts: async (id: string): Promise<Product[]> => {
    const res = await fetch(`${API_URL}/shelves/${id}/products`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(res, `/shelves/${id}/products`);
    return sanitizeDocs(Array.isArray(data) ? data : data.products || []);
  },
};

// Zones API
export const zones = {
  list: async () => {
    const res = await fetch(`${API_URL}/zones`);
    const data = await handleResponse(res, '/zones');
    return sanitizeDocs(Array.isArray(data) ? data : data.results || []);
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/zones/${id}`);
    return sanitizeDoc(await handleResponse(res, `/zones/${id}`));
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/zones`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, '/zones'));
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/zones/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return sanitizeDoc(await handleResponse(res, `/zones/${id}`));
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/zones/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/zones/${id}`);
  },

  getShelves: async (id: string) => {
    const res = await fetch(`${API_URL}/zones/${id}/shelves`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, `/zones/${id}/shelves`);
    return sanitizeDocs(Array.isArray(data) ? data : data.shelves || []);
  },
};


// Dashboard API
export const dashboard = {
  topMoving: async () => {
    const res = await fetch(`${API_URL}/dashboard/top-moving`);
    return handleResponse(res, '/dashboard/top-moving');
  },

  shelves: async () => {
    const res = await fetch(`${API_URL}/dashboard/shelves`);
    return handleResponse(res, '/dashboard/shelves');
  },

  daily: async () => {
    const res = await fetch(`${API_URL}/dashboard/daily`);
    return handleResponse(res, '/dashboard/daily');
  },

  liveTasks: async () => {
    const res = await fetch(`${API_URL}/dashboard/live/tasks`);
    return handleResponse(res, '/dashboard/live/tasks');
  },

  liveRobots: async () => {
    const res = await fetch(`${API_URL}/dashboard/live/robots`);
    return handleResponse(res, '/dashboard/live/robots');
  },

  liveSystem: async () => {
    const res = await fetch(`${API_URL}/dashboard/live/system`);
    return handleResponse(res, '/dashboard/live/system');
  },

  taskStats: async () => {
    const res = await fetch(`${API_URL}/tasks/stats/live`);
    return handleResponse(res, '/tasks/stats/live');
  },
};

// Maps API
export const maps = {
  // Get complete map data with all entities
  getData: async () => {
    const res = await fetch(`${API_URL}/maps/data`, {
      headers: getHeaders(),
    });
    return handleResponse(res, '/maps/data');
  },

  // Get merged occupancy grid (legacy endpoint)
  getMerged: async () => {
    const res = await fetch(`${API_URL}/maps/merged`, {
      headers: getHeaders(),
    });
    return handleResponse(res, '/maps/merged');
  },

  // Get map metadata only (dimensions, resolution, origin)
  getMetadata: async () => {
    const res = await fetch(`${API_URL}/maps/metadata`, {
      headers: getHeaders(),
    });
    return handleResponse(res, '/maps/metadata');
  },

  // Update map metadata (admin only)
  updateMetadata: async (metadata: {
    width?: number;
    height?: number;
    resolution?: number;
    origin?: { x: number; y: number };
  }) => {
    const res = await fetch(`${API_URL}/maps/metadata`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(metadata),
    });
    return handleResponse(res, '/maps/metadata');
  },

  // Get occupancy grid only
  getOccupancyGrid: async () => {
    const res = await fetch(`${API_URL}/maps/occupancy-grid`, {
      headers: getHeaders(),
    });
    return handleResponse(res, '/maps/occupancy-grid');
  },
};

// Real-time task endpoints
export const realtimeTasks = {
  updatePosition: async (id: string, position: { x: number; y: number; yaw?: number }) => {
    const res = await fetch(`${API_URL}/tasks/realtime/${id}/position`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(position),
    });
    return handleResponse(res, `/tasks/realtime/${id}/position`);
  },

  updateStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_URL}/tasks/realtime/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, `/tasks/realtime/${id}/status`);
  },

  getForMap: async (id: string) => {
    const res = await fetch(`${API_URL}/tasks/realtime/${id}`);
    return sanitizeDoc(await handleResponse(res, `/tasks/realtime/${id}`));
  },

  getAllForMap: async () => {
    const res = await fetch(`${API_URL}/tasks/realtime/map/all`);
    const data = await handleResponse(res, '/tasks/realtime/map/all');
    return sanitizeDocs(Array.isArray(data) ? data : data.tasks || []);
  },

  getRobotTasks: async (robotId: string) => {
    const res = await fetch(`${API_URL}/tasks/realtime/map/robot/${robotId}`);
    const data = await handleResponse(res, `/tasks/realtime/map/robot/${robotId}`);
    return sanitizeDocs(Array.isArray(data) ? data : data.tasks || []);
  },
};


// =========================================================
// Tasks API
// =========================================================

export const tasks = {
  // -------------------------------------
  // LIST ALL TASKS
  // Optional filters for status, robot, shelf
  // -------------------------------------
  list: async (filters?: {
    status?: TaskStatus;
    robot_id?: string;
    shelf_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.robot_id) params.append('robot_id', filters.robot_id);
    if (filters?.shelf_id) params.append('shelf_id', filters.shelf_id);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const url = params.toString()
      ? `${API_URL}/tasks?${params.toString()}`
      : `${API_URL}/tasks`;

    const res = await fetch(url);
    const data = await handleResponse(res, '/tasks');
    return sanitizeDocs(Array.isArray(data) ? data : data.results || []);
  },

  // -------------------------------------
  // GET SINGLE TASK
  // Includes state history
  // -------------------------------------
  get: async (id: string): Promise<Task> => {
    const res = await fetch(`${API_URL}/tasks/${id}`);
    return sanitizeDoc(await handleResponse(res, `/tasks/${id}`));
  },

  // -------------------------------------
  // CREATE & ASSIGN TASK
  // Automatically assigns best available robot
  // Task types: PICKUP_AND_DELIVER, MOVE_SHELF, RETURN_SHELF, REPOSITION
  // -------------------------------------
  create: async (data: TaskCreate): Promise<Task> => {
    if (!data.shelf_id || data.shelf_id.trim() === '') {
      throw new Error('shelf_id is required');
    }

    if (data.priority === undefined || data.priority < 1 || data.priority > 10) {
      throw new Error('priority must be between 1 and 10');
    }

    const payload: any = {
      shelf_id: String(data.shelf_id).trim(),
      priority: Number(data.priority),
      task_type: data.task_type || 'PICKUP_AND_DELIVER',
    };

    if (data.description !== undefined) {
      payload.description = data.description ? String(data.description).trim() : null;
    }
    if (data.zone_id !== undefined) {
      payload.zone_id = data.zone_id ? String(data.zone_id).trim() : null;
    }
    if (data.target_shelf_id !== undefined) {
      payload.target_shelf_id = data.target_shelf_id;
    }
    if (data.target_zone_id !== undefined) {
      payload.target_zone_id = data.target_zone_id;
    }

    console.log('[Tasks API] Creating task with payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${API_URL}/tasks/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to create task');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // UPDATE TASK STATUS
  // Handle task lifecycle state transitions
  // -------------------------------------
  updateStatus: async (
    id: string,
    new_status: TaskStatus,
    metadata?: { old_status?: TaskStatus; current_target?: string }
  ): Promise<Task> => {
    const payload: any = {
      new_status: String(new_status).toUpperCase(),
    };

    if (metadata?.old_status) {
      payload.old_status = metadata.old_status;
    }
    if (metadata?.current_target) {
      payload.current_target = metadata.current_target;
    }

    console.log('[Tasks API] Updating task status:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${API_URL}/tasks/realtime/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to update task');
      error.status = res.status;
      error.details = responseData?.details || [];
      throw error;
    }

    return sanitizeDoc(responseData);
  },

  // -------------------------------------
  // UPDATE ROBOT POSITION FOR TASK
  // Called by robots during task execution
  // Shelf location remains FIXED, only robot position updates
  // -------------------------------------
  updateRobotPosition: async (
    id: string,
    robot_x: number,
    robot_y: number,
    status?: TaskStatus
  ): Promise<any> => {
    if (isNaN(robot_x) || isNaN(robot_y)) {
      throw new Error('robot_x and robot_y must be valid numbers');
    }

    const payload: any = {
      robot_x: Number(robot_x),
      robot_y: Number(robot_y),
    };

    if (status) {
      payload.status = String(status).toUpperCase();
    }

    console.log('[Tasks API] Updating robot position:', payload);

    const res = await fetch(`${API_URL}/tasks/realtime/${id}/position`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to update robot position');
      error.status = res.status;
      throw error;
    }

    return responseData;
  },

  // -------------------------------------
  // GET TASK FOR MAP DISPLAY
  // Returns task with shelf storage/current locations
  // and robot position for real-time visualization
  // -------------------------------------
  getTaskMapView: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tasks/realtime/${id}`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(res, `/tasks/realtime/${id}`);
    return data?.task || data;
  },

  // -------------------------------------
  // GET ALL ACTIVE TASKS FOR MAP
  // Returns all tasks in progress for map display
  // -------------------------------------
  getAllTasksMapView: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/tasks/realtime/map/all`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(res, '/tasks/realtime/map/all');
    return data?.tasks || [];
  },

  // -------------------------------------
  // GET ROBOT'S ACTIVE TASKS
  // Returns all tasks assigned to a specific robot
  // -------------------------------------
  getRobotTasks: async (robot_id: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/tasks/realtime/map/robot/${robot_id}`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(res, `/tasks/realtime/map/robot/${robot_id}`);
    return data?.tasks || [];
  },

  // -------------------------------------
  // CANCEL TASK
  // Cancel a task and restore shelf to storage
  // -------------------------------------
  cancel: async (id: string): Promise<Task> => {
    console.log('[Tasks API] Cancelling task', id);

    return tasks.updateStatus(id, 'CANCELLED' as TaskStatus, {
      old_status: 'PENDING' as TaskStatus,
    });
  },

  // -------------------------------------
  // DELETE TASK
  // Remove a task completely
  // -------------------------------------
  delete: async (id: string): Promise<any> => {
    console.log('[Tasks API] Deleting task', id);

    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to delete task');
      error.status = res.status;
      throw error;
    }

    return responseData;
  },

  // -------------------------------------
  // GET LIVE STATISTICS
  // Real-time task and robot statistics for dashboard
  // -------------------------------------
  getLiveStats: async (): Promise<{
    tasks: {
      total: number;
      assigned: number;
      in_progress: number;
      completed: number;
      failed: number;
      average_duration_seconds: number;
    };
    robots: {
      total: number;
      available: number;
      busy: number;
      offline: number;
    };
    timestamp: string;
  }> => {
    const res = await fetch(`${API_URL}/tasks/stats/live`);
    const data = await handleResponse(res, '/tasks/stats/live');
    return data;
  },

  // -------------------------------------
  // BROADCAST MAP UPDATE
  // Trigger broadcast of all tasks to connected clients
  // Useful for syncing state after batch updates
  // -------------------------------------
  broadcastMapUpdate: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/tasks/realtime/broadcast-map-update`, {
      method: 'POST',
      headers: getHeaders(),
    });

    const responseData = await res.json();

    if (!res.ok) {
      const error: any = new Error(responseData?.error || 'Failed to broadcast map update');
      error.status = res.status;
      throw error;
    }

    return responseData;
  },
};