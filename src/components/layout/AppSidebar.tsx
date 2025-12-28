import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bot,
  Package,
  Map,
  ListTodo,
  Box,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Bot, label: 'Robots', path: '/robots' },
  { icon: Box, label: 'Shelves', path: '/shelves' },
  { icon: Layers, label: 'Zones', path: '/zones' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ListTodo, label: 'Tasks', path: '/tasks' },
  { icon: Map, label: 'Map', path: '/map' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { logout, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn('flex items-center gap-2 overflow-hidden', collapsed && 'w-0')}>
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display font-bold text-lg gradient-text whitespace-nowrap">
            WareBot
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-2 mt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <RouterNavLink
              key={item.path}
              to={item.path}
              className={cn(
                'nav-link',
                isActive && 'active',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  'transition-all duration-200 whitespace-nowrap',
                  collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                )}
              >
                {item.label}
              </span>
            </RouterNavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-sidebar-border">
        <RouterNavLink
          to="/settings"
          className={cn(
            'nav-link',
            location.pathname === '/settings' && 'active',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              'transition-all duration-200 whitespace-nowrap',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            Settings
          </span>
        </RouterNavLink>
        <button
          onClick={logout}
          className={cn(
            'nav-link w-full text-destructive hover:text-destructive hover:bg-destructive/10',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              'transition-all duration-200 whitespace-nowrap',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
