// Prefer explicit environment variable `VITE_API_URL`. If not provided, fall back to proxy path '/api'.
const API_URL = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
const DEBUG_MODE = true; // Set to false in production

let token: string | null = localStorage.getItem('token');

export const setToken = (newToken: string | null) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('token', newToken);
  } else {
    localStorage.removeItem('token');
  }
};

export const getToken = () => token;

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Always check localStorage for the most current token
  const currentToken = localStorage.getItem('token');
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  return headers;
};

// Helper to handle API responses
const handleResponse = async (res: Response, endpoint: string) => {
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    let errorMessage = `API Error: ${res.status} ${res.statusText}`;
    let responseBody = '';
    
    try {
      if (contentType?.includes('application/json')) {
        const error = await res.json();
        errorMessage = error.message || error.error || errorMessage;
        responseBody = JSON.stringify(error, null, 2);
      } else if (contentType?.includes('text/html')) {
        responseBody = await res.text();
        // Backend is returning HTML error page
        errorMessage = `Backend error at ${endpoint}. Status: ${res.status}. Check server logs for details.`;
      } else {
        responseBody = await res.text();
      }
    } catch (e) {
      // Response is not JSON or text
    }
    
    const fullError = {
      endpoint,
      status: res.status,
      statusText: res.statusText,
      message: errorMessage,
      body: responseBody,
    };

    // Log verbose debug info, but throw a safe Error object with details attached
    if (DEBUG_MODE) {
      console.error(`[API DEBUG] Failed to fetch ${endpoint}:`, fullError);
    } else {
      console.error(`Failed to fetch ${endpoint}:`, errorMessage);
    }

    const err = new Error(errorMessage);
    // Attach structured details so callers can present sanitized messages
    (err as any).details = fullError;
    throw err;
  }
  
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON response from ${endpoint}, got ${contentType}`);
  }
  
  return res.json();
};

// Sanitize documents returned from backend: convert Mongo `_id` to `id` string
// and coerce known numeric fields to numbers for consistent frontend usage.
const sanitizeDoc = (doc: any) => {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  if (out._id) {
    try {
      out.id = String(out._id);
    } catch (e) {
      out.id = out._id;
    }
    delete out._id;
  }

  // Numeric fields we expect on tasks/shelves/zones
  const numericKeys = ['x', 'y', 'yaw', 'target_x', 'target_y', 'target_yaw', 'pickup_x', 'pickup_y', 'pickup_yaw', 'drop_x', 'drop_y', 'drop_yaw', 'priority'];
  for (const k of numericKeys) {
    if (out[k] !== undefined && out[k] !== null) {
      const n = Number(out[k]);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }

  return out;
};

export const auth = {
  register: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || error.error || 'Registration failed');
    }
    return res.json();
  },

  login: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Login failed');
    }
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
    }
    return data;
  },

  logout: () => {
    setToken(null);
  },
};

// Health check endpoint to diagnose backend issues
export const health = {
  check: async () => {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return { status: 'ok', data: await res.json() };
      }
      return { status: 'error', code: res.status, text: res.statusText };
    } catch (error: any) {
      return { status: 'error', message: error.message || 'Backend unreachable', apiUrl: API_URL };
    }
  },

  testDashboard: async () => {
    const results = {
      topMoving: null as any,
      shelves: null as any,
      daily: null as any,
    };

    try {
      results.topMoving = await dashboard.topMoving();
    } catch (e: any) {
      results.topMoving = { error: e.message };
    }

    try {
      results.shelves = await dashboard.shelves();
    } catch (e: any) {
      results.shelves = { error: e.message };
    }

    try {
      results.daily = await dashboard.daily();
    } catch (e: any) {
      results.daily = { error: e.message };
    }

    return results;
  },
};

export const products = {
  list: async () => {
    const res = await fetch(`${API_URL}/products`);
    return res.json();
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/products/${id}`);
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  search: async (q: string) => {
    if (!q || q.trim() === '') return [];
    const res = await fetch(`${API_URL}/products/search?q=${encodeURIComponent(q)}`);
    return res.json();
  },

  uploadImage: async (productId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const currentToken = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/products/${productId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentToken}` },
      body: formData,
    });
    return res.json();
  },

  deleteImage: async (productId: string, index: number) => {
    const res = await fetch(`${API_URL}/products/${productId}/images/${index}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  setMainImage: async (productId: string, imageUrl: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/images/set-main`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ image_url: imageUrl }),
    });
    return res.json();
  },

  getImages: async (productId: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/images`);
    return res.json();
  },

  pickStock: async (productId: string, quantity: number, description?: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/pick`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ quantity, description }),
    });
    return res.json();
  },

  returnStock: async (productId: string, quantity: number, description?: string) => {
    const res = await fetch(`${API_URL}/products/return`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, quantity, description }),
    });
    return res.json();
  },

  adjustStock: async (productId: string, newQuantity: number, reason?: string) => {
    const res = await fetch(`${API_URL}/products/adjust`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, new_quantity: newQuantity, reason }),
    });
    return res.json();
  },

  getTransactions: async (productId: string) => {
    const res = await fetch(`${API_URL}/products/${productId}/transactions`, {
      headers: getHeaders(),
    });
    return res.json();
  },
};

export const robots = {
  list: async () => {
    const res = await fetch(`${API_URL}/robots`);
    const data = await res.json();
    // Backend now returns { results: [...], pagination: {...} }
    // For backward compatibility, handle both formats
    return Array.isArray(data) ? data : (data.results || data);
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to get robot: ${res.statusText}`);
    }
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/robots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create robot');
    }
    return res.json();
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update robot');
    }
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete robot');
    }
    return res.json();
  },
};

export const shelves = {
  list: async () => {
    const res = await fetch(`${API_URL}/shelves`);
    return res.json();
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/shelves/${id}`);
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/shelves`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/shelves/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/shelves/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  getProducts: async (id: string) => {
    const res = await fetch(`${API_URL}/shelves/${id}/products`, {
      headers: getHeaders(),
    });
    return res.json();
  },
};

export const zones = {
  list: async () => {
    const res = await fetch(`${API_URL}/zones`);
    return handleResponse(res, '/zones');
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/zones/${id}`);
    return handleResponse(res, `/zones/${id}`);
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/zones`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, '/zones (POST)');
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/zones/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/zones/${id} (DELETE)`);
  },
};

export const tasks = {
  list: async () => {
    const res = await fetch(`${API_URL}/tasks`);
    const data = await handleResponse(res, '/tasks');
    if (Array.isArray(data)) return data.map(sanitizeDoc);
    if (data && Array.isArray(data.results)) return data.results.map(sanitizeDoc);
    return sanitizeDoc(data);
  },

  assign: async (data: any) => {
    const res = await fetch(`${API_URL}/tasks/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const created = await handleResponse(res, '/tasks/assign');
    return sanitizeDoc(created);
  },

  setReferencePoint: async (robotId: string, data: any) => {
    const res = await fetch(`${API_URL}/tasks/${robotId}/reference-point`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error('Failed to set reference point');
    }
    return res.json();
  },

  start: async (robotId: string) => {
    const res = await fetch(`${API_URL}/tasks/${robotId}/start`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to start task');
    }
    return res.json();
  },

  stop: async (robotId: string) => {
    const res = await fetch(`${API_URL}/tasks/${robotId}/stop`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to stop task');
    }
    return res.json();
  },

  create: async (data: any) => {
    // Reuse assign which performs error logging and throws on failure
    return tasks.assign(data);
  },
  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `/tasks/${id} (DELETE)`);
  },
};

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
};

export const maps = {
  getMerged: async () => {
    const res = await fetch(`${API_URL}/maps/merged`);
    return res.json();
  },
};
