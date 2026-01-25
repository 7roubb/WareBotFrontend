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
      // Use efficient server-side stats for tasks and robots
      // Use list lengths for shelves and products (until dedicated stats endpoints exist)
      const [liveStats, shelvesData, productsData] = await Promise.all([
        tasks.getLiveStats().catch(() => null),
        shelves.list().catch(() => []),
        products.list().catch(() => []),
      ]);

      if (liveStats) {
        setStats({
          totalRobots: liveStats.robots.total,
          activeRobots: liveStats.robots.busy + liveStats.robots.available, // "Active" usually means online
          totalTasks: liveStats.tasks.total,
          completedTasks: liveStats.tasks.completed,
          pendingTasks: liveStats.tasks.assigned + (liveStats.tasks as any).pending || 0, // Fallback if pending not in type
          activeTasks: liveStats.tasks.in_progress,
          totalShelves: shelvesData.length,
          totalProducts: productsData.length,
          systemHealth: liveStats.robots.available > 0 ? 'healthy' : liveStats.robots.total > 0 ? 'warning' : 'critical',
        });
      } else {
        // Fallback to legacy validation if stats endpoint fails
        console.warn('Live stats endpoint failed, falling back to manual calculation');
        const [robotsData, tasksDataLegacy] = await Promise.all([
          robots.list().catch(() => []),
          tasks.list().catch(() => []),
        ]);

        const activeRobots = robotsData.filter((r: Robot) => r.status === 'IDLE' || r.status === 'BUSY');
        const completedTasks = tasksDataLegacy.filter((t: Task) => t.status === 'COMPLETED');
        const pendingTasks = tasksDataLegacy.filter((t: Task) => t.status === 'PENDING' || t.status === 'ASSIGNED');
        const activeTasks = tasksDataLegacy.filter((t: Task) => ['MOVING_TO_PICKUP', 'ATTACHED', 'MOVING_TO_DROP', 'ARRIVED_AT_DROP'].includes(t.status));

        setStats({
          totalRobots: robotsData.length,
          activeRobots: activeRobots.length,
          totalTasks: tasksDataLegacy.length,
          completedTasks: completedTasks.length,
          pendingTasks: pendingTasks.length,
          activeTasks: activeTasks.length,
          totalShelves: shelvesData.length,
          totalProducts: productsData.length,
          systemHealth: activeRobots.length > 0 ? 'healthy' : robotsData.length > 0 ? 'warning' : 'critical',
        });
      }
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
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const { onConnectionChange } = await import('@/services/websocket');
        unsubscribe = onConnectionChange((isConnected) => {
          setConnected(isConnected);
          if (isConnected) setError(null);
        });
      } catch (e: any) {
        setError(e.message || 'Failed to initialize WebSocket');
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { connected, error };
}
