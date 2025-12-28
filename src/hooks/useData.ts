import { useState, useEffect, useCallback } from 'react';
import { robots, shelves, tasks, dashboard, products, zones } from '@/services/api';
import type { Robot, Shelf, Task, Product, Zone, DashboardStats } from '@/types';

// Generic fetch hook
function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Robots hook
export function useRobots() {
  return useFetch<Robot[]>(robots.list);
}

export function useRobot(id: string) {
  return useFetch<Robot>(() => robots.get(id), [id]);
}

// Shelves hook
export function useShelves() {
  return useFetch<Shelf[]>(shelves.list);
}

export function useShelf(id: string) {
  return useFetch<Shelf>(() => shelves.get(id), [id]);
}

// Tasks hook
export function useTasks() {
  return useFetch<Task[]>(tasks.list);
}

export function useTask(id: string) {
  return useFetch<Task>(() => tasks.get(id), [id]);
}

// Zones hook
export function useZones() {
  return useFetch<Zone[]>(zones.list);
}

export function useZone(id: string) {
  return useFetch<Zone>(() => zones.get(id), [id]);
}

// Products hook
export function useProducts() {
  return useFetch<Product[]>(products.list);
}

export function useProduct(id: string) {
  return useFetch<Product>(() => products.get(id), [id]);
}

// Dashboard stats hook
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [robotsData, tasksData, shelvesData, productsData] = await Promise.all([
        robots.list().catch(() => []),
        tasks.list().catch(() => []),
        shelves.list().catch(() => []),
        products.list().catch(() => []),
      ]);

      const activeRobots = robotsData.filter((r: Robot) => r.status === 'busy' || r.status === 'idle');
      const activeTasks = tasksData.filter((t: Task) => !['COMPLETED', 'CANCELLED', 'FAILED'].includes(t.status));
      const completedTasks = tasksData.filter((t: Task) => t.status === 'COMPLETED');
      const pendingTasks = tasksData.filter((t: Task) => t.status === 'PENDING');

      setStats({
        totalRobots: robotsData.length,
        activeRobots: activeRobots.length,
        totalTasks: tasksData.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        activeTasks: activeTasks.length,
        totalShelves: shelvesData.length,
        totalProducts: productsData.length,
        systemHealth: activeRobots.length > 0 ? 'healthy' : robotsData.length > 0 ? 'warning' : 'critical',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { stats, loading, error, refetch };
}

// Real-time connection hook
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('@/services/websocket').then(({ connectWebSocket, isConnected, disconnectWebSocket }) => {
      connectWebSocket()
        .then(() => setConnected(true))
        .catch((e) => setError(e.message));

      return () => {
        disconnectWebSocket();
      };
    });
  }, []);

  return { connected, error };
}
