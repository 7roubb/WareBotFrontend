import { useEffect, useState } from 'react';
import { Bot, Plus, Edit, Trash2, X, Battery, Cpu, Thermometer, Activity } from 'lucide-react';
import { robots } from '../services/api';
import { connectWebSocket } from '../services/websocket';

export default function Robots() {
  const [robotList, setRobotList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRobot, setEditingRobot] = useState<any>(null);
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
              : r
          )
        );
      });
    }

    // Poll robot status every 5 seconds
    const statusInterval = setInterval(async () => {
      try {
        const updatedRobots = await robots.list();
        setRobotList((prev) =>
          prev.map((currentRobot) => {
            const updated = updatedRobots.find((r: any) => r.id === currentRobot.id);
            return updated ? { ...currentRobot, ...updated } : currentRobot;
          })
        );
      } catch (error) {
        console.error('Failed to refresh robot status:', error);
      }
    }, 5000);

    return () => {
      if (socket) {
        socket.off('telemetry');
      }
      clearInterval(statusInterval);
    };
  }, []);

  const loadRobots = async () => {
    const data = await robots.list();
    setRobotList(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRobot) {
        await robots.update(editingRobot.id, formData);
      } else {
        await robots.create(formData);
      }
      loadRobots();
      closeModal();
    } catch (error) {
      console.error('Failed to save robot:', error);
    }
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
      setFormData({
        name: '',
        robot_id: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRobot(null);
  };

  const getStatusColor = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'IDLE': 'bg-green-500',
      'CHARGING': 'bg-orange-500',
      'BUSY': 'bg-yellow-500',
      'OFFLINE': 'bg-red-500',
    };
    return statusMap[status] || 'bg-gray-500';
  };

  const getStatusTextColor = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'IDLE': 'text-green-400',
      'CHARGING': 'text-orange-400',
      'BUSY': 'text-yellow-400',
      'OFFLINE': 'text-red-400',
    };
    return statusMap[status] || 'text-gray-400';
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-500';
    if (level > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Robots</h1>
          <p className="text-accent-400">Monitor and manage fleet of robots</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Robot</span>
        </button>
      </div>

      {/* Robots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {robotList.map((robot) => {
          // Real-time values from WebSocket
          const batteryLevel = robot.battery_level ?? 0;
          const cpuUsage = robot.cpu_usage ?? 0;
          const ramUsage = robot.ram_usage ?? 0;
          const temperature = robot.temperature ?? 0;
          const status = robot.status ?? 'UNKNOWN';
          
          return (
          <div
            key={robot.id}
            className="group bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500 hover:shadow-neo transition duration-300"
          >
            {/* Header */}
            <div className="bg-accent-800/50 p-6 border-b border-accent-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                    <Bot className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{robot.name}</h3>
                    <p className="text-xs text-accent-500">{robot.robot_id}</p>
                  </div>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${getStatusColor(status)} animate-pulse`}
                />
              </div>
              <div className="text-sm">
                <span className="text-accent-400">Status: </span>
                <span className={`font-bold text-lg ${getStatusTextColor(status)}`}>{status}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="flex items-center space-x-2 mb-1">
                    <Battery
                      className={`w-4 h-4 ${getBatteryColor(batteryLevel)}`}
                    />
                    <span className="text-xs text-accent-400">Battery</span>
                  </div>
                  <p className="text-lg font-bold text-primary-300">
                    {batteryLevel.toFixed(0)}%
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="flex items-center space-x-2 mb-1">
                    <Cpu className="w-4 h-4 text-primary-300" />
                    <span className="text-xs text-accent-400">CPU</span>
                  </div>
                  <p className="text-lg font-bold text-primary-300">
                    {cpuUsage.toFixed(0)}%
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="flex items-center space-x-2 mb-1">
                    <Activity className="w-4 h-4 text-primary-300" />
                    <span className="text-xs text-accent-400">RAM</span>
                  </div>
                  <p className="text-lg font-bold text-primary-300">
                    {ramUsage.toFixed(0)}%
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="flex items-center space-x-2 mb-1">
                    <Thermometer className="w-4 h-4 text-primary-300" />
                    <span className="text-xs text-accent-400">Temp</span>
                  </div>
                  <p className="text-lg font-bold text-primary-300">
                    {temperature.toFixed(0)}°C
                  </p>
                </div>
              </div>

              {(robot.x !== null || robot.y !== null) && (
                <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                  <p className="text-xs text-accent-500 mb-1">Position</p>
                  <p className="text-sm font-mono text-accent-200">
                    X: {robot.x?.toFixed(2) || '--'}, Y: {robot.y?.toFixed(2) || '--'}
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
