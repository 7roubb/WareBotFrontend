import { useEffect, useState } from 'react';
import {
  Bot,
  Plus,
  Edit,
  Trash2,
  X,
  Battery,
  Cpu,
  Thermometer,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { robots, tasks } from '../services/api';
import { onTelemetry, onRobotUpdate } from '../services/websocket';

export default function Robots() {
  const [robotList, setRobotList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRobot, setEditingRobot] = useState<any>(null);
  const [
    backendStatus,
    setBackendStatus,
  ] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [formData, setFormData] = useState({
    name: '',
    robot_id: '',
  });

  useEffect(() => {
    loadRobots();

    // Subscribe to real-time telemetry updates (PRIMARY SOURCE)
    const unsubscribeTelemetry = onTelemetry((data: any) => {
      console.log('[Robots] Telemetry Update:', {
        robot_id: data.robot_id || data.robot || data.id,
        position: { x: data.x, y: data.y },
        yaw: data.yaw,
        battery: data.battery_level,
        cpu: data.cpu_usage,
        ram: data.ram_usage,
        temp: data.temperature
      });

      setRobotList((prev) =>
        prev.map((r) => {
          // Match by robot_id, robot, name, or id field
          const isMatch = 
            r.robot_id === data.robot_id || 
            r.robot_id === data.robot || 
            r.name === data.name ||
            r.id === data.id ||
            r.robot_id === data.id;
          
          if (isMatch) {
            console.log(`[Robots] Updating robot ${r.robot_id} with telemetry`);
            return {
              ...r,
              // Position fields
              x: data.x !== undefined ? Number(data.x) : (data.current_x !== undefined ? Number(data.current_x) : r.x),
              y: data.y !== undefined ? Number(data.y) : (data.current_y !== undefined ? Number(data.current_y) : r.y),
              yaw: data.yaw !== undefined ? Number(data.yaw) : (data.current_yaw !== undefined ? Number(data.current_yaw) : r.yaw),
              current_x: data.x !== undefined ? Number(data.x) : (data.current_x !== undefined ? Number(data.current_x) : r.current_x),
              current_y: data.y !== undefined ? Number(data.y) : (data.current_y !== undefined ? Number(data.current_y) : r.current_y),
              current_yaw: data.yaw !== undefined ? Number(data.yaw) : (data.current_yaw !== undefined ? Number(data.current_yaw) : r.current_yaw),
              // Sensor telemetry
              cpu_usage: data.cpu_usage !== undefined ? Number(data.cpu_usage) : r.cpu_usage,
              ram_usage: data.ram_usage !== undefined ? Number(data.ram_usage) : r.ram_usage,
              battery_level: data.battery_level !== undefined ? Number(data.battery_level) : r.battery_level,
              temperature: data.temperature !== undefined ? Number(data.temperature) : r.temperature,
              status: data.status !== undefined ? data.status : r.status,
            };
          }
          return r;
        }),
      );
    });

    // Subscribe to robot updates (FALLBACK)
    const unsubscribeRobotUpdate = onRobotUpdate((data: any) => {
      console.log('[Robots] Robot Update (fallback):', data);

      setRobotList((prev) =>
        prev.map((r) => {
          const isMatch = 
            r.robot_id === data.robot_id ||
            r.robot_id === data.robot ||
            r.id === data.robot_id ||
            r.id === data.id;

          if (isMatch) {
            console.log(`[Robots] Updating robot ${r.robot_id} with robot update`);
            return {
              ...r,
              x: data.x !== undefined ? Number(data.x) : (data.current_x !== undefined ? Number(data.current_x) : r.x),
              y: data.y !== undefined ? Number(data.y) : (data.current_y !== undefined ? Number(data.current_y) : r.y),
              yaw: data.yaw !== undefined ? Number(data.yaw) : (data.current_yaw !== undefined ? Number(data.current_yaw) : r.yaw),
              current_x: data.x !== undefined ? Number(data.x) : (data.current_x !== undefined ? Number(data.current_x) : r.current_x),
              current_y: data.y !== undefined ? Number(data.y) : (data.current_y !== undefined ? Number(data.current_y) : r.current_y),
              current_yaw: data.yaw !== undefined ? Number(data.yaw) : (data.current_yaw !== undefined ? Number(data.current_yaw) : r.current_yaw),
              cpu_usage: data.cpu_usage !== undefined ? Number(data.cpu_usage) : r.cpu_usage,
              ram_usage: data.ram_usage !== undefined ? Number(data.ram_usage) : r.ram_usage,
              battery_level: data.battery_level !== undefined ? Number(data.battery_level) : r.battery_level,
              temperature: data.temperature !== undefined ? Number(data.temperature) : r.temperature,
              status: data.status !== undefined ? data.status : r.status,
            };
          }
          return r;
        }),
      );
    });

    // Background refresh interval for POSITION ONLY (every 0.1 seconds for smooth movement)
    const positionInterval = setInterval(async () => {
      try {
        const updated = await robots.list();
        
        setRobotList((prev) =>
          prev.map((robot) => {
            const found = updated.find((r: any) => r.id === robot.id);
            if (found) {
              // ONLY update position fields, keep everything else unchanged
              return {
                ...robot,
                x: found.x !== undefined ? found.x : found.current_x,
                y: found.y !== undefined ? found.y : found.current_y,
                yaw: found.yaw !== undefined ? found.yaw : found.current_yaw,
              };
            }
            return robot;
          }),
        );
      } catch {
        // Silently ignore errors on position refresh
      }
    }, 100); // Update position every 0.1 seconds (100ms)

    // Background refresh interval for TASK STATUS ONLY (every 0.2 seconds)
    const taskStatusInterval = setInterval(async () => {
      try {
        const tasksData = await tasks.list().catch(() => []);
        // Tasks data is available but we don't display it in Robots page
        // This keeps task status updated in the background
      } catch (error) {
        // Silently ignore task status refresh errors
      }
    }, 200); // Update task status every 0.2 seconds (200ms)

    return () => {
      unsubscribeTelemetry();
      unsubscribeRobotUpdate();
      clearInterval(positionInterval);
      clearInterval(taskStatusInterval);
    };
  }, []);

  const loadRobots = async () => {
    try {
      const data = await robots.list();
      console.log('[DEBUG] robots.list() response:', data);
      setBackendStatus('connected');
      // Map current_x/current_y to x/y for consistency
      const mappedRobots = data.map((robot: any) => ({
        ...robot,
        x: robot.x !== undefined ? robot.x : robot.current_x,
        y: robot.y !== undefined ? robot.y : robot.current_y,
        yaw: robot.yaw !== undefined ? robot.yaw : robot.current_yaw,
      }));
      console.log('[DEBUG] Mapped robots:', mappedRobots);
      setRobotList(mappedRobots);
    } catch (error) {
      console.error('[DEBUG] Error loading robots:', error);
      setBackendStatus('disconnected');
      setRobotList([]);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      if (editingRobot) {
        await robots.update(editingRobot.id, formData);
      } else {
        await robots.create(formData);
      }
      loadRobots();
      closeModal();
    } catch (e) {}
  };

  const handleDelete = async (robotId: string) => {
    if (confirm('Delete this robot?')) {
      try {
        await robots.delete(robotId);
        loadRobots();
      } catch (error) {
        console.error('Error deleting robot:', error);
        alert('Failed to delete robot');
      }
    }
  };

  const openModal = (robot?: any) => {
    if (robot) {
      setEditingRobot(robot);
      setFormData({
        name: robot.name,
        robot_id: robot.robot_id,
      });
    } else {
      setEditingRobot(null);
      setFormData({ name: '', robot_id: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRobot(null);
  };

  const getStatusColor = (s: string) => {
    const map: any = {
      IDLE: 'bg-green-500',
      CHARGING: 'bg-orange-500',
      BUSY: 'bg-yellow-500',
      OFFLINE: 'bg-red-500',
    };
    return map[s] || 'bg-gray-500';
  };

  const getStatusTextColor = (s: string) => {
    const map: any = {
      IDLE: 'text-green-400',
      CHARGING: 'text-orange-400',
      BUSY: 'text-yellow-400',
      OFFLINE: 'text-red-400',
    };
    return map[s] || 'text-gray-400';
  };

  const getBatteryColor = (l: number) => {
    if (l > 60) return 'text-green-500';
    if (l > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-8">
      {backendStatus === 'disconnected' && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-300" />
            <div>
              <p className="font-semibold text-sm text-yellow-300">
                Backend Server Not Connected
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Robots</h1>
          <p className="text-accent">
            Monitor and manage fleet of robots
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-bold shadow-lg hover:brightness-110 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Robot</span>
        </button>
      </div>

      {/* ROBOT CARDS */}
      <div className="data-grid">
        {robotList.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p className="text-sm mb-2">No robots found</p>
            <p className="text-xs">Click "Add Robot" to create one, or check backend connection</p>
          </div>
        )}
        {robotList.map((robot) => {
          const battery = robot.battery_level ?? 0;
          const cpu = robot.cpu_usage ?? 0;
          const ram = robot.ram_usage ?? 0;
          const temp = robot.temperature ?? 0;
          const status = robot.status ?? 'UNKNOWN';

          return (
            <div
              key={robot.id}
              className="group bg-card/80 backdrop-blur rounded-xl border border-border/30 shadow-md overflow-hidden hover:border-primary/30 hover:shadow-lg transition duration-300"
            >
              {/* HEADER */}
              <div className="bg-card/50 p-4 border-b border-border/30">
                <div className="flex items-start justify-between mb-3">
                  
                  {/* LEFT SIDE — Robot Icon + Name */}
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{robot.name}</h3>
                      <p className="text-xs text-muted-foreground">{robot.robot_id}</p>
                    </div>
                  </div>

                  {/* RIGHT SIDE — Grafana + Status Light */}
                  <div className="flex flex-col items-center space-y-2">
                    
                    {/* Grafana Button */}
                    <button
                      onClick={() =>
                        window.open(
                          `http://localhost:3000/d/warebot-pro/warebot-robotics-pro-dashboard?var-robot=${robot.robot_id}&orgId=1&refresh=5s`,
                          '_blank'
                        )
                      }
                      className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition"
                      title="Open Grafana Dashboard"
                    >
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/3/3b/Grafana_icon.svg"
                        alt="Grafana"
                        className="w-4 h-4"
                      />
                    </button>
                  </div>
                </div>

                {/* Status Text */}
                <div className="text-sm flex items-center justify-between">
                  {/* LEFT SIDE: Status text */}
                  <div>
                    <span className="text-muted-foreground text-xs">Status:</span>
                    <span className={`font-bold text-sm ml-1 ${getStatusTextColor(status)}`}>
                      {status}
                    </span>
                  </div>

                  {/* RIGHT SIDE: Status light */}
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(status)} animate-pulse`}
                  />
                </div>
              </div>

              {/* STATS */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center space-x-1 mb-1">
                      <Battery
                        className={`w-3 h-3 ${getBatteryColor(battery)}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        Battery
                      </span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {battery.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center space-x-1 mb-1">
                      <Cpu className="w-3 h-3 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        CPU
                      </span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {cpu.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center space-x-1 mb-1">
                      <Activity className="w-3 h-3 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        RAM
                      </span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {ram.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center space-x-1 mb-1">
                      <Thermometer className="w-3 h-3 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        Temp
                      </span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {temp.toFixed(0)}°C
                    </p>
                  </div>
                </div>

                {(robot.x !== null && robot.x !== undefined) || (robot.y !== null && robot.y !== undefined) ? (
                  <div className="p-2 rounded-lg bg-card/50 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">
                      Position
                    </p>
                    <p className="text-xs font-mono text-foreground">
                      X: {robot.x?.toFixed(2) ?? '--'}, Y:{' '}
                      {robot.y?.toFixed(2) ?? '--'}
                    </p>
                    {robot.yaw !== null && robot.yaw !== undefined && (
                      <p className="text-xs font-mono text-foreground mt-1">
                        Yaw: {robot.yaw?.toFixed(2) ?? '--'}° (Heading)
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="flex space-x-1 pt-2">
                  <button
                    onClick={() => openModal(robot)}
                    className="flex-1 px-2 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-semibold transition flex items-center justify-center space-x-1"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(robot.id)}
                    className="flex-1 px-2 py-1 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 text-xs font-semibold transition flex items-center justify-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-md w-full border border-border/30">
            <div className="bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30">
              <h2 className="text-2xl font-bold flex items-center">
                <Bot className="w-6 h-6 mr-3 text-primary" />
                {editingRobot ? 'Edit Robot' : 'New Robot'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-secondary/50 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Robot Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Robot ID *
                </label>
                <input
                  type="text"
                  value={formData.robot_id}
                  onChange={(e) =>
                    setFormData({ ...formData, robot_id: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="e.g., robot1"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  MQTT topic: robots/mp400/[robot_id]/status
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg font-bold hover:brightness-110 transition"
                >
                  {editingRobot ? 'Update Robot' : 'Create Robot'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
