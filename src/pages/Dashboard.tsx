import { StatCard } from '@/components/dashboard/StatCard';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { useDashboardStats, useRobots, useTasks } from '@/hooks/useData';
import { Bot, Package, Box, ListTodo, Activity, Zap, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: robotsList, loading: robotsLoading } = useRobots();
  const { data: tasksList, loading: tasksLoading } = useTasks();

  const loading = statsLoading || robotsLoading || tasksLoading;

  if (loading && !stats) {
    return <LoadingPage text="Loading dashboard..." />;
  }

  const recentTasks = tasksList?.slice(0, 5) || [];
  const activeRobots = robotsList?.filter((r) => r.status !== 'offline').slice(0, 5) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Monitor your warehouse operations in real-time"
      />

      {/* Stats Grid */}
      <div className="data-grid">
        <StatCard
          title="Active Robots"
          value={stats?.activeRobots ?? 0}
          subtitle={`${stats?.totalRobots ?? 0} total`}
          icon={Bot}
          variant="primary"
        />
        <StatCard
          title="Active Tasks"
          value={stats?.activeTasks ?? 0}
          subtitle={`${stats?.pendingTasks ?? 0} pending`}
          icon={ListTodo}
          variant="warning"
        />
        <StatCard
          title="Completed Today"
          value={stats?.completedTasks ?? 0}
          icon={Activity}
          variant="success"
        />
        <StatCard
          title="Total Shelves"
          value={stats?.totalShelves ?? 0}
          icon={Box}
          variant="default"
        />
        <StatCard
          title="Products"
          value={stats?.totalProducts ?? 0}
          icon={Package}
          variant="default"
        />
        <StatCard
          title="System Status"
          value={stats?.systemHealth === 'healthy' ? 'Healthy' : stats?.systemHealth === 'warning' ? 'Warning' : 'Critical'}
          icon={Zap}
          variant={stats?.systemHealth === 'healthy' ? 'success' : stats?.systemHealth === 'warning' ? 'warning' : 'danger'}
        />
      </div>

      {/* Recent Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Robots */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-display">Active Robots</CardTitle>
            <Link to="/robots" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {activeRobots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active robots</p>
            ) : (
              <div className="space-y-3">
                {activeRobots.map((robot) => (
                  <div
                    key={robot.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{robot.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Battery: {robot.battery_level ?? 100}%
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={robot.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-display">Recent Tasks</CardTitle>
            <Link to="/tasks" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent tasks</p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <ListTodo className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium">Task #{task.id.slice(-6)}</p>
                        <p className="text-xs text-muted-foreground">
                          Robot: {task.robot_id?.slice(-6) || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/tasks"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <ListTodo className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Create Task</span>
            </Link>
            <Link
              to="/robots"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <Bot className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Manage Robots</span>
            </Link>
            <Link
              to="/map"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">View Map</span>
            </Link>
            <Link
              to="/products"
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <Package className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Inventory</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
