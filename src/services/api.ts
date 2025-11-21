const API_URL = 'http://localhost:5000/api';

let token: string | null = localStorage.getItem('token');

export const setToken = (newToken: string | null) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('token', newToken);
  } else {
    localStorage.removeItem('token');
  }
};

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const auth = {
  login: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    setToken(data.access_token);
    return data;
  },

  logout: () => {
    setToken(null);
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

  uploadImage: async (productId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_URL}/products/${productId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
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
};

export const robots = {
  list: async () => {
    const res = await fetch(`${API_URL}/robots`);
    return res.json();
  },

  get: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`);
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/robots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/robots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
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
};

export const tasks = {
  list: async () => {
    const res = await fetch(`${API_URL}/tasks`);
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_URL}/tasks/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

export const dashboard = {
  topMoving: async () => {
    const res = await fetch(`${API_URL}/dashboard/top-moving`);
    return res.json();
  },

  shelves: async () => {
    const res = await fetch(`${API_URL}/dashboard/shelves`);
    return res.json();
  },

  daily: async () => {
    const res = await fetch(`${API_URL}/dashboard/daily`);
    return res.json();
  },
};

export const maps = {
  getMerged: async () => {
    const res = await fetch(`${API_URL}/maps/merged`);
    return res.json();
  },
};
