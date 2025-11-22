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
import { robots } from '../services/api';
import { connectWebSocket } from '../services/websocket';

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

    const socket = connectWebSocket();
    if (socket) {
      socket.on('telemetry', (data) => {
        setRobotList((prev) =>
          prev.map((r) =>
            r.robot_id === data.robot
              ? {
                  ...r,
                  cpu_usage: data.cpu,
                  ram_usage: data.ram,
                  battery_level: data.battery,
                  temperature: data.temperature,
                  x: data.x,
                  y: data.y,
                  status: data.status,
                }
              : r,
          ),
        );
      });
    }

    const statusInterval = setInterval(async () => {
      try {
        const updated = await robots.list();
        setBackendStatus('connected');
        setRobotList((prev) =>
          prev.map((robot) => {
            const found = updated.find((r: any) => r.id === robot.id);
            return found ? { ...robot, ...found } : robot;
          }),
        );
      } catch {
        setBackendStatus('disconnected');
      }
    }, 5000);

    return () => {
      if (socket) socket.off('telemetry');
      clearInterval(statusInterval);
    };
  }, []);

  const loadRobots = async () => {
    try {
      const data = await robots.list();
      setBackendStatus('connected');
      setRobotList(data);
    } catch {
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

  const handleDelete = async (id: string) => {
    if (confirm('Delete this robot?')) {
      await robots.delete(id);
      loadRobots();
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
          <p className="text-accent-400">
            Monitor and manage fleet of robots
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Robot</span>
        </button>
      </div>

      {/* ROBOT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {robotList.map((robot) => {
          const battery = robot.battery_level ?? 0;
          const cpu = robot.cpu_usage ?? 0;
          const ram = robot.ram_usage ?? 0;
          const temp = robot.temperature ?? 0;
          const status = robot.status ?? 'UNKNOWN';

          return (
            <div
              key={robot.id}
              className="group bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500 hover:shadow-neo transition duration-300"
            >
              {/* HEADER */}
           <div className="bg-accent-800/50 p-6 border-b border-accent-700">
  <div className="flex items-start justify-between mb-4">
    
    {/* LEFT SIDE — Robot Icon + Name */}
    <div className="flex items-center space-x-3">
      <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
        <Bot className="w-6 h-6 text-primary-400" />
      </div>
      <div>
        <h3 className="font-bold text-white">{robot.name}</h3>
        <p className="text-xs text-accent-500">{robot.robot_id}</p>
      </div>
    </div>

    {/* RIGHT SIDE — Grafana + Status Light */}
    <div className="flex flex-col items-center space-y-2">
      
      {/* ⭐ Grafana Button ⭐ */}
      <button
        onClick={() =>
          window.open(
            `http://localhost:3000/d/warebot-pro/warebot-robotics-pro-dashboard?var-robot=${robot.robot_id}&orgId=1&refresh=5s`,
            '_blank'
          )
        }
        className="p-2 rounded-lg bg-accent-700 hover:bg-accent-600 transition"
        title="Open Grafana Dashboard"
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/3/3b/Grafana_icon.svg"
          alt="Grafana"
          className="w-6 h-6"
        />
      </button>

      {/* ⭐ Status Light Under Grafana ⭐ */}

    </div>

  </div>

  {/* Status Text */}
 <div className="text-sm flex items-center justify-between">
  {/* LEFT SIDE: Status text */}
  <div>
    <span className="text-accent-400">Status: </span>
    <span className={`font-bold text-lg ${getStatusTextColor(status)}`}>
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
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <div className="flex items-center space-x-2 mb-1">
                      <Battery
                        className={`w-4 h-4 ${getBatteryColor(
                          battery,
                        )}`}
                      />
                      <span className="text-xs text-accent-400">
                        Battery
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary-300">
                      {battery.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <div className="flex items-center space-x-2 mb-1">
                      <Cpu className="w-4 h-4 text-primary-300" />
                      <span className="text-xs text-accent-400">
                        CPU
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary-300">
                      {cpu.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <div className="flex items-center space-x-2 mb-1">
                      <Activity className="w-4 h-4 text-primary-300" />
                      <span className="text-xs text-accent-400">
                        RAM
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary-300">
                      {ram.toFixed(0)}%
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                    <div className="flex items-center space-x-2 mb-1">
                      <Thermometer className="w-4 h-4 text-primary-300" />
                      <span className="text-xs text-accent-400">
                        Temp
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary-300">
                      {temp.toFixed(0)}°C
                    </p>
                  </div>
                </div>

                {(robot.x !== null || robot.y !== null) && (
                  <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                    <p className="text-xs text-accent-500 mb-1">
                      Position
                    </p>
                    <p className="text-sm font-mono text-accent-200">
                      X: {robot.x?.toFixed(2) ?? '--'}, Y:{' '}
                      {robot.y?.toFixed(2) ?? '--'}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2 pt-3">
                  <button
                    onClick={() => openModal(robot)}
                    className="flex-1 px-3 py-2 rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 border border-primary-500/30 text-xs font-semibold transition"
                  >
                    <Edit className="w-3 h-3 inline mr-1" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(robot.id)}
                    className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" /> Delete
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
          <div className="bg-gradient-card rounded-2xl shadow-neo max-w-md w-full border border-accent-700">
            <div className="bg-accent-800/80 backdrop-blur text-white p-6 flex items-center justify-between border-b border-accent-700 rounded-t-2xl">
              <h2 className="text-2xl font-bold flex items-center">
                <Bot className="w-6 h-6 mr-3 text-primary-400" />
                {editingRobot ? 'Edit Robot' : 'New Robot'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-accent-700 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-accent-200 mb-2">
                  Robot Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-accent-200 mb-2">
                  Robot ID *
                </label>
                <input
                  type="text"
                  value={formData.robot_id}
                  onChange={(e) =>
                    setFormData({ ...formData, robot_id: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  placeholder="e.g., robot1"
                  required
                />
                <p className="text-xs text-accent-500 mt-2">
                  MQTT topic: robots/mp400/[robot_id]/status
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition"
                >
                  {editingRobot ? 'Update Robot' : 'Create Robot'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-accent-700/50 text-accent-300 rounded-lg font-semibold hover:bg-accent-700 transition border border-accent-600"
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
