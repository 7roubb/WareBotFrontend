import { useEffect, useState } from 'react';
import { TrendingUp, Package, Grid, Activity, AlertCircle } from 'lucide-react';
import { dashboard } from '../services/api';

export default function Dashboard() {
  const [topMoving, setTopMoving] = useState<any[]>([]);
  const [shelfSummary, setShelfSummary] = useState<any[]>([]);
  const [dailyMovements, setDailyMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      setBackendStatus('checking');
      const [top, shelves, daily] = await Promise.all([
        dashboard.topMoving().catch(err => {
          setBackendStatus('disconnected');
          console.error('Failed to load top moving products:', err);
          return [];
        }),
        dashboard.shelves().catch(err => {
          setBackendStatus('disconnected');
          console.error('Failed to load shelves:', err);
          // Return mock data when backend fails
          return [
            { shelf_id: 'S1', coords: [1, 1], level: 1, products: 5, total_items: 25 },
            { shelf_id: 'S2', coords: [1, 2], level: 1, products: 8, total_items: 40 },
            { shelf_id: 'S3', coords: [2, 1], level: 2, products: 3, total_items: 15 },
          ];
        }),
        dashboard.daily().catch(err => {
          setBackendStatus('disconnected');
          console.error('Failed to load daily movements:', err);
          return [];
        }),
      ]);
      setTopMoving(Array.isArray(top) ? top : []);
      setShelfSummary(Array.isArray(shelves) ? shelves : []);
      setDailyMovements(Array.isArray(daily) ? daily : []);
      if (backendStatus !== 'disconnected') {
        setBackendStatus('connected');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setBackendStatus('disconnected');
      setError('Unable to load some dashboard data. Showing fallback data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Backend Status Banner */}
      {backendStatus === 'disconnected' && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-300" />
            <div>
              <p className="font-semibold text-sm text-yellow-300">Backend Server Not Connected</p>
              <p className="text-xs text-yellow-400 mt-2">The Flask backend is not running on <code className="bg-black/30 px-2 py-1 rounded text-yellow-200 font-mono">localhost:5000</code></p>
              <p className="text-xs text-yellow-400 mt-2">Start the backend server from: <code className="bg-black/30 px-2 py-1 rounded text-yellow-200 font-mono">/home/super/Desktop/warebot-backend</code></p>
              <p className="text-xs text-yellow-300 mt-2">Command: <code className="bg-black/30 px-2 py-1 rounded text-yellow-200 font-mono">python main.py</code></p>
              <p className="text-xs text-yellow-300 mt-2">✓ Currently showing fallback data</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-accent-400">Real-time warehouse monitoring and control</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent-700/30 border border-accent-600">
          <Activity className="w-5 h-5 text-green-400 animate-pulse" />
          <span className="text-sm font-medium text-accent-200">Live Updates</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Moving Products Card */}
        <div className="group">
          <div className="relative bg-gradient-card rounded-xl p-6 border border-accent-700 hover:border-primary-500 shadow-neo-md transition duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                  <Package className="w-6 h-6 text-primary-500" />
                </div>
                <span className="text-3xl font-bold text-white">{topMoving.length}</span>
              </div>
              <p className="text-accent-300 text-sm">Top Moving Products</p>
              <p className="text-xs text-accent-500 mt-1">Updated just now</p>
            </div>
          </div>
        </div>

        {/* Active Shelves Card */}
        <div className="group">
          <div className="relative bg-gradient-card rounded-xl p-6 border border-accent-700 hover:border-primary-500 shadow-neo-md transition duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                  <Grid className="w-6 h-6 text-primary-500" />
                </div>
                <span className="text-3xl font-bold text-white">{shelfSummary.length}</span>
              </div>
              <p className="text-accent-300 text-sm">Active Shelves</p>
              <p className="text-xs text-accent-500 mt-1">All systems operational</p>
            </div>
          </div>
        </div>

        {/* Daily Movements Card */}
        <div className="group">
          <div className="relative bg-gradient-card rounded-xl p-6 border border-accent-700 hover:border-primary-500 shadow-neo-md transition duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                  <TrendingUp className="w-6 h-6 text-primary-500" />
                </div>
                <span className="text-3xl font-bold text-white">
                  {dailyMovements.reduce((sum, m) => sum + m.qty, 0)}
                </span>
              </div>
              <p className="text-accent-300 text-sm">Daily Movements</p>
              <p className="text-xs text-accent-500 mt-1">24-hour activity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
          <div className="p-6 border-b border-accent-700 bg-accent-800/50">
            <h2 className="text-lg font-bold text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-3 text-primary-500" />
              Top Moving Products
            </h2>
          </div>
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {topMoving.slice(0, 5).map((item, idx) => (
              <div
                key={item._id}
                className="flex items-center justify-between p-3 rounded-lg bg-accent-800/30 hover:bg-accent-800/50 transition border border-accent-700/50"
              >
                <div className="flex items-center min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-yellow flex items-center justify-center text-accent-900 font-bold text-sm mr-3 flex-shrink-0">
                    {idx + 1}
                  </div>
                  <span className="font-medium text-accent-200 truncate">
                    Product {item._id.slice(-6)}
                  </span>
                </div>
                <span className="ml-4 px-3 py-1 rounded-full text-sm font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30 flex-shrink-0">
                  {item.total} units
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Shelf Summary */}
        <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
          <div className="p-6 border-b border-accent-700 bg-accent-800/50">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Grid className="w-5 h-5 mr-3 text-primary-500" />
              Shelf Summary
            </h2>
          </div>
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {shelfSummary.slice(0, 5).map((shelf) => (
              <div
                key={shelf.shelf_id}
                className="p-3 rounded-lg bg-accent-800/30 hover:bg-accent-800/50 transition border border-accent-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-accent-200">
                      Shelf ({shelf.coords[0]}, {shelf.coords[1]})
                    </p>
                    <p className="text-xs text-accent-500 mt-1">Level {shelf.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary-300">{shelf.products} products</p>
                    <p className="text-xs text-accent-500">{shelf.total_items} items</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
        <div className="p-6 border-b border-accent-700 bg-accent-800/50">
          <h2 className="text-lg font-bold text-white flex items-center">
            <Activity className="w-5 h-5 mr-3 text-primary-500" />
            Today's Activity
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {dailyMovements.map((movement) => (
              <div
                key={movement._id}
                className="p-4 rounded-lg bg-accent-800/30 border border-accent-700/50 hover:border-primary-500/50 transition"
              >
                <p className="text-xs text-accent-500 mb-2">{movement._id}</p>
                <p className="text-2xl font-bold text-primary-400">{movement.qty}</p>
                <p className="text-xs text-accent-500 mt-2">movements</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
