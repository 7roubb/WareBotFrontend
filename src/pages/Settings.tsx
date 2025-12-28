import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { Server, Bell, Shield, Palette } from 'lucide-react';

export default function Settings() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_URL || '/api');
  const [wsUrl, setWsUrl] = useState(import.meta.env.VITE_WS_URL || 'http://localhost:5000');
  const [notifications, setNotifications] = useState(true);

  const handleSaveConnection = () => {
    // In a real app, this would persist to localStorage or update env
    toast({ title: 'Settings saved', description: 'Connection settings have been updated.' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Configure your WareBot dashboard"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection Settings */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Connection</CardTitle>
                <CardDescription>Backend API and WebSocket settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API URL</Label>
              <Input
                id="apiUrl"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:5000/api"
              />
              <p className="text-xs text-muted-foreground">
                Set VITE_API_URL in your .env file for production
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wsUrl">WebSocket URL</Label>
              <Input
                id="wsUrl"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="http://localhost:5000"
              />
              <p className="text-xs text-muted-foreground">
                Set VITE_WS_URL in your .env file for real-time updates
              </p>
            </div>
            <Button onClick={handleSaveConnection} className="w-full">
              Save Connection Settings
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage alerts and notifications</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Task Notifications</Label>
                <p className="text-xs text-muted-foreground">Get notified on task updates</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Robot Alerts</Label>
                <p className="text-xs text-muted-foreground">Alert when robots go offline</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>System Warnings</Label>
                <p className="text-xs text-muted-foreground">Critical system notifications</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={user?.username || 'N/A'} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user?.role || 'N/A'} disabled className="capitalize" />
            </div>
          </CardContent>
        </Card>

        {/* Theme Info */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Dashboard theme settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The dashboard uses a dark industrial theme optimized for warehouse monitoring.
              Additional theme options can be added in future updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
