import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { health } from '../services/api';

export default function Diagnostics() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [dashboardTest, setDashboardTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    const healthResult = await health.check();
    const dashboardResult = await health.testDashboard();
    setHealthStatus(healthResult);
    setDashboardTest(dashboardResult);
    setLoading(false);
  };

  const getStatusIcon = (status: string | null) => {
    if (status === 'ok') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'error') return <XCircle className="w-5 h-5 text-red-400" />;
    return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">System Diagnostics</h1>
          <p className="text-accent-400">Check backend connectivity and endpoint health</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Diagnostics</span>
        </button>
      </div>

      {/* Backend Health */}
      <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
        <div className="p-6 border-b border-accent-700 bg-accent-800/50">
          <h2 className="text-xl font-bold text-white flex items-center space-x-3">
            {getStatusIcon(healthStatus?.status)}
            <span>Backend Health</span>
          </h2>
        </div>
        <div className="p-6">
          {healthStatus ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <p className="text-sm text-accent-400 mb-2">Status:</p>
                <p className={`text-lg font-bold ${healthStatus.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                  {healthStatus.status === 'ok' ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              {healthStatus.message && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-300">{healthStatus.message}</p>
                </div>
              )}
              {healthStatus.code && (
                <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                  <p className="text-sm text-accent-400 mb-1">Error Code:</p>
                  <p className="font-mono text-accent-300">{healthStatus.code} {healthStatus.text}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-accent-400">Loading...</p>
          )}
        </div>
      </div>

      {/* Dashboard Endpoints */}
      <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
        <div className="p-6 border-b border-accent-700 bg-accent-800/50">
          <h2 className="text-xl font-bold text-white">Dashboard Endpoints</h2>
        </div>
        <div className="p-6 space-y-4">
          {dashboardTest ? (
            <>
              {/* Top Moving */}
              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">/dashboard/top-moving</p>
                  {dashboardTest.topMoving?.error ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
                {dashboardTest.topMoving?.error && (
                  <p className="text-xs text-red-400">{dashboardTest.topMoving.error}</p>
                )}
                {!dashboardTest.topMoving?.error && dashboardTest.topMoving && (
                  <p className="text-xs text-green-400">
                    ✓ Returned {Array.isArray(dashboardTest.topMoving) ? dashboardTest.topMoving.length : 'data'}
                  </p>
                )}
              </div>

              {/* Shelves */}
              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">/dashboard/shelves</p>
                  {dashboardTest.shelves?.error ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
                {dashboardTest.shelves?.error && (
                  <p className="text-xs text-red-400">{dashboardTest.shelves.error}</p>
                )}
                {!dashboardTest.shelves?.error && dashboardTest.shelves && (
                  <p className="text-xs text-green-400">
                    ✓ Returned {Array.isArray(dashboardTest.shelves) ? dashboardTest.shelves.length : 'data'}
                  </p>
                )}
              </div>

              {/* Daily */}
              <div className="p-4 rounded-lg bg-accent-800/30 border border-accent-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">/dashboard/daily</p>
                  {dashboardTest.daily?.error ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
                {dashboardTest.daily?.error && (
                  <p className="text-xs text-red-400">{dashboardTest.daily.error}</p>
                )}
                {!dashboardTest.daily?.error && dashboardTest.daily && (
                  <p className="text-xs text-green-400">
                    ✓ Returned {Array.isArray(dashboardTest.daily) ? dashboardTest.daily.length : 'data'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-accent-400">Loading...</p>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden">
        <div className="p-6 border-b border-accent-700 bg-accent-800/50">
          <h2 className="text-xl font-bold text-white">Debug Information</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-accent-400 mb-1">Frontend URL:</p>
              <p className="font-mono text-accent-300 bg-accent-800/30 p-2 rounded">{window.location.origin}</p>
            </div>
            <div>
              <p className="text-accent-400 mb-1">API Base URL:</p>
              <p className="font-mono text-accent-300 bg-accent-800/30 p-2 rounded">{window.location.origin}/api</p>
            </div>
            <div>
              <p className="text-accent-400 mb-1">WebSocket URL:</p>
              <p className="font-mono text-accent-300 bg-accent-800/30 p-2 rounded">
                ws://{window.location.hostname}:5000
              </p>
            </div>
            <div className="pt-4 border-t border-accent-700">
              <p className="text-accent-500 text-xs">
                To fix backend errors, check the Flask server logs. The dashboard endpoints are returning 500 errors,
                which indicates an issue with the backend data or database connection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
