import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <AppSidebar />}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          isAuthenticated ? 'ml-16 md:ml-64' : ''
        )}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
