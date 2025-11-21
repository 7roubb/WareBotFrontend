import { useEffect, useState } from 'react';
import { ClipboardList, Plus, X } from 'lucide-react';
import { tasks, shelves } from '../services/api';
import { connectWebSocket } from '../services/websocket';

export default function Tasks() {
  const [taskList, setTaskList] = useState<any[]>([]);
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    shelf_id: '',
    priority: 1,
    description: '',
  });

  useEffect(() => {
    loadTasks();
    loadShelves();

    const socket = connectWebSocket();
    if (socket) {
      socket.on('task_status', (data) => {
        setTaskList((prev) =>
          prev.map((t) =>
            t.id === data.task_id ? { ...t, status: data.status } : t
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off('task_status');
      }
    };
  }, []);

  const loadTasks = async () => {
    const data = await tasks.list();
    setTaskList(data);
  };

  const loadShelves = async () => {
    const data = await shelves.list();
    setShelfList(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tasks.create(formData);
      loadTasks();
      closeModal();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const openModal = () => {
    setFormData({
      shelf_id: '',
      priority: 1,
      description: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'FAILED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Tasks</h1>
          <p className="text-accent-400">Assign and track robot task assignments</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Assign Task</span>
        </button>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {taskList.map((task) => (
          <div
            key={task.id}
            className="group bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500 hover:shadow-neo transition duration-300"
          >
            {/* Header */}
            <div className="bg-accent-800/50 p-6 border-b border-accent-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                    <ClipboardList className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Task #{task.id.slice(-6)}</h3>
                    <p className="text-xs text-accent-500">Priority {task.priority}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Status</div>
                  <p className="text-sm font-bold text-primary-300">{task.status}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Robot</div>
                  <p className="text-sm font-bold text-primary-300">{task.assigned_robot_name || '--'}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                <div className="text-xs text-accent-400 mb-1">Shelf ID</div>
                <p className="text-sm font-mono text-accent-200">{task.shelf_id.slice(-8)}</p>
              </div>

              {task.description && (
                <div className="p-3 rounded-lg bg-accent-800/30 border border-accent-700">
                  <p className="text-xs text-accent-300">{task.description}</p>
                </div>
              )}

              <div className="pt-2 text-xs text-accent-500 border-t border-accent-700">
                Created: {new Date(task.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-card rounded-xl shadow-neo max-w-md w-full border border-accent-700">
            <div className="bg-accent-800/80 text-white p-6 flex items-center justify-between border-b border-accent-700">
              <h2 className="text-2xl font-bold">Assign New Task</h2>
              <button
                onClick={closeModal}
                className="hover:bg-accent-700 p-2 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Shelf *
                </label>
                <select
                  value={formData.shelf_id}
                  onChange={(e) =>
                    setFormData({ ...formData, shelf_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  required
                >
                  <option value="">Select a shelf</option>
                  {shelfList.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      Shelf ({shelf.x_coord}, {shelf.y_coord}) - Level {shelf.level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Priority (1-10) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition placeholder-accent-600"
                  placeholder="Enter task details..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition"
                >
                  Assign Task
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-accent-700 text-accent-200 rounded-lg font-semibold hover:bg-accent-600 transition"
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
