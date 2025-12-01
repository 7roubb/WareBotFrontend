import { useEffect, useState } from 'react';
import { ClipboardList, Plus, X } from 'lucide-react';
import { tasks, shelves, zones } from '../services/api';
import { connectWebSocket } from '../services/websocket';

export default function Tasks() {
  const [taskList, setTaskList] = useState<any[]>([]);
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [zoneList, setZoneList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form data for new task
  const [formData, setFormData] = useState({
    shelf_id: '',
    task_type: 'PICKUP_AND_DELIVER',
    priority: '1',
    description: '',
    zone_id: '',
    target_shelf_id: '',
    target_zone_id: '',
  });

  useEffect(() => {
    loadTasks();
    loadShelves();
    loadZones();

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
      if (socket) socket.off('task_status');
    };
  }, []);

  const loadTasks = async () => {
    try {
      const data = await tasks.list();
      setTaskList(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setTaskList([]);
    }
  };

  const loadShelves = async () => {
    try {
      const data = await shelves.list();
      setShelfList(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load shelves:', error);
    }
  };

  const loadZones = async () => {
    try {
      const data = await zones.list();
      setZoneList(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZoneList([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: any = {
        shelf_id: formData.shelf_id,
        priority: Number(formData.priority) || 1,
        task_type: formData.task_type,
      };

      // Add optional fields
      if (formData.description && formData.description.trim() !== '') {
        payload.description = formData.description.trim();
      }
      if (formData.zone_id && formData.zone_id !== '') {
        payload.zone_id = formData.zone_id;
      }
      if (formData.target_shelf_id && formData.target_shelf_id !== '') {
        payload.target_shelf_id = formData.target_shelf_id;
      }
      if (formData.target_zone_id && formData.target_zone_id !== '') {
        payload.target_zone_id = formData.target_zone_id;
      }

      console.log('Creating task with payload:', payload);

      await tasks.create(payload);
      await loadTasks();
      closeModal();
      alert(`Task created successfully`);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      const msg = error?.message || String(error);
      alert(`Failed to create task: ${msg}`);
    }
  };

  const openModal = () => {
    setFormData({
      shelf_id: '',
      task_type: 'PICKUP_AND_DELIVER',
      priority: '1',
      description: '',
      zone_id: '',
      target_shelf_id: '',
      target_zone_id: '',
    });
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

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
              <div className="bg-accent-800/50 p-6 border-b border-accent-700 flex items-start justify-between">
                <div className="flex-1">
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
                <div>
                  <button
                    onClick={async () => {
                      if (!confirm('Cancel this task?')) return;
                      try {
                        await tasks.delete(task.id);
                        // reload list
                        await loadTasks();
                        alert('Task cancelled');
                      } catch (e: any) {
                        console.error('Failed to delete task:', e);
                        const msg = e?.message || 'Failed to delete task';
                        alert(msg);
                      }
                    }}
                    className="text-xs text-red-300 bg-red-600/10 px-3 py-1 rounded-md border border-red-500/20 hover:bg-red-600/20"
                  >
                    Delete
                  </button>
                </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Status</div>
                  <p className="text-sm font-bold text-primary-300">{task.status}</p>
                </div>

                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Type</div>
                  <p className="text-sm font-bold text-primary-300">{task.task_type || 'PICKUP_AND_DELIVER'}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <div className="text-xs text-accent-400 mb-1">Assigned Robot</div>
                <p className="text-sm font-bold text-primary-300">
                  {task.assigned_robot_name || '--'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                <div className="text-xs text-accent-400 mb-1">Pickup Coordinates</div>
                <p className="text-sm font-mono text-accent-200">
                  X: {((task.pickup_x ?? task.target_x) !== undefined ? Number(task.pickup_x ?? task.target_x).toFixed(2) : '—')},
                  Y: {((task.pickup_y ?? task.target_y) !== undefined ? Number(task.pickup_y ?? task.target_y).toFixed(2) : '—')},
                  Yaw: {((task.pickup_yaw ?? task.target_yaw) !== undefined ? Number(task.pickup_yaw ?? task.target_yaw).toFixed(2) : '—')}°
                </p>
              </div>

              {task.drop_x !== undefined && task.drop_y !== undefined && (task.drop_x !== task.pickup_x || task.drop_y !== task.pickup_y) && (
                <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                  <div className="text-xs text-accent-400 mb-1">Drop Coordinates</div>
                  <p className="text-sm font-mono text-accent-200">
                    X: {Number(task.drop_x).toFixed(2)}, Y: {Number(task.drop_y).toFixed(2)}, Yaw: {Number(task.drop_yaw ?? 0).toFixed(2)}°
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-accent-800/50 border border-accent-700">
                <div className="text-xs text-accent-400 mb-1">Priority</div>
                <p className="text-sm font-bold text-accent-200">{task.priority}</p>
              </div>

              <div className="pt-2 text-xs text-accent-500 border-t border-accent-700">
                Created: {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
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
                  Source Shelf *
                </label>
                <select
                  value={formData.shelf_id}
                  onChange={(e) =>
                    setFormData({ ...formData, shelf_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white"
                  required
                >
                  <option value="">Select a shelf to pick from</option>
                  {shelfList.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      Shelf @ ({Number(shelf.x_coord ?? shelf.x ?? 0).toFixed(1)}, {Number(shelf.y_coord ?? shelf.y ?? 0).toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Task Type *
                </label>
                <select
                  value={formData.task_type}
                  onChange={(e) =>
                    setFormData({ ...formData, task_type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white"
                  required
                >
                  <option value="PICKUP_AND_DELIVER">Pick & Deliver (to Zone)</option>
                  <option value="MOVE_SHELF">Move Shelf (to Location)</option>
                  <option value="RETURN_SHELF">Return Shelf (to Storage)</option>
                  <option value="REPOSITION">Reposition (in Warehouse)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Priority (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-accent-800/50 border border-accent-700 rounded-lg text-white"
                />
              </div>

              {/* Conditional fields based on task type */}
              {(formData.task_type === 'PICKUP_AND_DELIVER') && (
                <div>
                  <label className="block text-sm font-medium text-accent-300 mb-2">
                    Delivery Zone (optional)
                  </label>
                  <select
                    value={formData.zone_id}
                    onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                    className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white"
                  >
                    <option value="">No specific zone</option>
                    {zoneList.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name || z.zone_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.task_type === 'MOVE_SHELF') && (
                <div>
                  <label className="block text-sm font-medium text-accent-300 mb-2">
                    Target Shelf Location *
                  </label>
                  <select
                    value={formData.target_shelf_id}
                    onChange={(e) => setFormData({ ...formData, target_shelf_id: e.target.value })}
                    className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white"
                    required={formData.task_type === 'MOVE_SHELF'}
                  >
                    <option value="">Select target location</option>
                    {shelfList.filter((s) => s.id !== formData.shelf_id).map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        Shelf @ ({Number(shelf.x_coord ?? shelf.x ?? 0).toFixed(1)}, {Number(shelf.y_coord ?? shelf.y ?? 0).toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.task_type === 'REPOSITION') && (
                <div>
                  <label className="block text-sm font-medium text-accent-300 mb-2">
                    Target Zone *
                  </label>
                  <select
                    value={formData.target_zone_id}
                    onChange={(e) => setFormData({ ...formData, target_zone_id: e.target.value })}
                    className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white"
                    required={formData.task_type === 'REPOSITION'}
                  >
                    <option value="">Select target zone</option>
                    {zoneList.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name || z.zone_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-accent-800/50 border border-accent-700 rounded-lg text-white"
                  rows={2}
                  placeholder="Add task notes..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition"
                >
                  Create Task
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
