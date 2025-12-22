import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Bot,
  Grid,
  ClipboardList,
  Map,
  MapPin,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { connectWebSocket, disconnectWebSocket } from './services/websocket';
import { auth } from './services/api';
import { realtimeIntegration } from './services/realtimeIntegration';
import { errorHandler } from './utils/errorHandling';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Robots from './pages/Robots';
import Shelves from './pages/Shelves';
import Tasks from './pages/Tasks';
import MapPage from './pages/Map';
import Zones from './pages/Zones';

type Page = 'dashboard' | 'products' | 'robots' | 'shelves' | 'tasks' | 'map' | 'zones';
type AuthPage = 'login' | 'register';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPage, setAuthPage] = useState<AuthPage>('login');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [systemError, setSystemError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      connectWebSocket();
      
      // Initialize real-time system
      realtimeIntegration.initialize().catch((error) => {
        console.warn('[App] Real-time system initialization failed:', error);
        // App can still work without real-time features
      });
    }
  }, []);

  // Subscribe to system errors
  useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error) => {
      // Show critical errors to user
      if (error.type === 'CONNECTION_ERROR' || error.type === 'NETWORK_ERROR') {
        setSystemError(error.message);
        // Auto-hide after 5 seconds
        setTimeout(() => setSystemError(null), 5000);
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    connectWebSocket();
  };

  const handleLogout = () => {
    auth.logout();
    setIsAuthenticated(false);
    disconnectWebSocket();
  };

  if (!isAuthenticated) {
    return (
      <div className="transition-all duration-500 ease-in-out">
        {authPage === 'login' ? (
          <div className="animate-fadeIn">
            <Login onLogin={handleLogin} onSignUp={() => setAuthPage('register')} />
          </div>
        ) : (
          <div className="animate-fadeIn">
            <Register onRegisterSuccess={handleLogin} onBackToLogin={() => setAuthPage('login')} />
          </div>
        )}
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard, color: 'blue' },
    { id: 'products' as Page, label: 'Products', icon: Package, color: 'purple' },
    { id: 'robots' as Page, label: 'Robots', icon: Bot, color: 'blue' },
    { id: 'shelves' as Page, label: 'Shelves', icon: Grid, color: 'green' },
    { id: 'zones' as Page, label: 'Zones', icon: MapPin, color: 'teal' },
    { id: 'tasks' as Page, label: 'Tasks', icon: ClipboardList, color: 'orange' },
    { id: 'map' as Page, label: 'Map', icon: Map, color: 'cyan' },
  ];

  return (
    <div className="min-h-screen bg-gradient-main flex">
      {/* System Error Banner */}
      {systemError && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-4 flex items-center gap-3 z-50 animate-slideDown">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{systemError}</span>
        </div>
      )}

      <aside className="w-72 bg-gradient-to-b from-accent-800 via-accent-900 to-accent-900 text-white flex flex-col shadow-neo border-r border-accent-700">
        {/* Logo Section */}
        <div className="p-8 border-b border-accent-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-yellow flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent-900 font-bold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Warebot</h1>
              <p className="text-xs text-accent-400">Warehouse Control</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 group ${
                currentPage === item.id
                  ? 'bg-gradient-yellow text-accent-900 shadow-neo-md'
                  : 'text-accent-300 hover:bg-accent-700/50'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${currentPage === item.id ? 'text-accent-900' : ''}`} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-accent-700 space-y-3">
          <div className="px-4 py-2 rounded-lg bg-accent-700/30 border border-accent-600">
            <p className="text-xs text-accent-400 mb-1">Status</p>
            <p className="text-sm font-semibold text-green-400 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              Online
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-accent-300 hover:bg-red-500/10 hover:text-red-400 transition duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-main">
        <div className="p-8">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'products' && <Products />}
          {currentPage === 'robots' && <Robots />}
          {currentPage === 'shelves' && <Shelves />}
          {currentPage === 'zones' && <Zones />}
          {currentPage === 'tasks' && <Tasks />}
          {currentPage === 'map' && <MapPage />}
        </div>
      </main>
    </div>
  );
}

export default App;
