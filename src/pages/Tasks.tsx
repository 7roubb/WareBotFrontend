import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, AlertCircle, CheckCircle, Clock, Zap, MapPin } from 'lucide-react';
import type { Task, TaskCreate, TaskStatus, Shelf, Zone } from '@/types';
import { tasks } from '../services/api';
import { shelves } from '../services/api';
import { zones } from '../services/api';
import { connectWebSocket } from '../services/websocket';

interface FormData {
  shelf_id: string;
  priority: number;
  description: string;
  zone_id: string;
  task_type: 'PICKUP_AND_DELIVER' | 'MOVE_SHELF' | 'RETURN_SHELF' | 'REPOSITION';
  target_shelf_id?: string;
  target_zone_id?: string;
}

const TASK_STATUSES: TaskStatus[] = [
  'PENDING',
  'ASSIGNED',
  'MOVING_TO_PICKUP',
  'ARRIVED_AT_PICKUP',
  'ATTACHED',
  'MOVING_TO_DROP',
  'ARRIVED_AT_DROP',
  'RELEASED',
  'MOVING_TO_REFERENCE',
  'COMPLETED',
  'ERROR',
  'CANCELLED',
];

const TASK_TYPES = [
  { value: 'PICKUP_AND_DELIVER', label: 'Pick up & Deliver to Zone' },
  { value: 'MOVE_SHELF', label: 'Move Shelf to Another Location' },
  { value: 'RETURN_SHELF', label: 'Return Shelf to Storage' },
  { value: 'REPOSITION', label: 'Reposition Shelf in Zone' },
];

export default function Tasks() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [shelfList, setShelfList] = useState<Shelf[]>([]);
  const [zoneList, setZoneList] = useState<Zone[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const initialFormData: FormData = {
    shelf_id: '',
    priority: 5,
    description: '',
    zone_id: '',
    task_type: 'PICKUP_AND_DELIVER',
    target_shelf_id: undefined,
    target_zone_id: undefined,
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);

  useEffect(() => {
    loadData();

    // Subscribe to real-time updates
    const socket = connectWebSocket();
    if (socket) {
      socket.on('task_update', (data: any) => {
        setTaskList((prev) =>
          prev.map((t) => (t.id === data.task?.id ? { ...t, ...data.task } : t))
        );
      });
      socket.on('tasks_update', (data: any) => {
        if (data.tasks) {
          setTaskList(data.tasks);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('task_update');
        socket.off('tasks_update');
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);

      // Load all data in parallel
      const [taskData, shelfData, zoneData, statsData] = await Promise.all([
        tasks.list(),
        shelves.list(),
        zones.list(),
        tasks.getLiveStats(),
      ]);

      console.log('[DEBUG] Tasks API response:', taskData);
      console.log('[DEBUG] Shelves API response:', shelfData);
      console.log('[DEBUG] Zones API response:', zoneData);
      console.log('[DEBUG] Stats API response:', statsData);

      setTaskList(Array.isArray(taskData) ? taskData : []);
      setShelfList(Array.isArray(shelfData) ? shelfData : []);
      setZoneList(Array.isArray(zoneData) ? zoneData : []);
      setStats(statsData);
    } catch (err: any) {
      console.error('[DEBUG] Failed to load data:', err);
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.shelf_id || formData.shelf_id.trim() === '') {
      return 'Shelf is required';
    }

    if (formData.priority < 1 || formData.priority > 10) {
      return 'Priority must be between 1 and 10';
    }

    if (formData.task_type === 'PICKUP_AND_DELIVER' && !formData.zone_id) {
      return 'Zone is required for PICKUP_AND_DELIVER tasks';
    }

    if (formData.task_type === 'MOVE_SHELF' && !formData.target_shelf_id) {
      return 'Target Shelf is required for MOVE_SHELF tasks';
    }

    if (formData.task_type === 'REPOSITION' && !formData.target_zone_id) {
      return 'Target Zone is required for REPOSITION tasks';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const submitData: TaskCreate = {
        shelf_id: formData.shelf_id.trim(),
        priority: Number(formData.priority),
        task_type: formData.task_type,
        description: formData.description ? formData.description.trim() : undefined,
        zone_id: formData.zone_id ? formData.zone_id.trim() : undefined,
        target_shelf_id: formData.target_shelf_id,
        target_zone_id: formData.target_zone_id,
      };

      console.log('[Tasks] Submitting:', JSON.stringify(submitData, null, 2));

      if (editingTask) {
        // Update existing task (status only)
        // await tasks.update(editingTask.id, submitData);
        setError('Task editing is not supported in this version');
      } else {
        // Create new task
        await tasks.create(submitData);
      }

      await loadData();
      closeModal();
    } catch (err: any) {
      console.error('[Tasks] Error:', err);

      let fullError = err?.message || 'Failed to create task';

      if (err?.details && Array.isArray(err.details)) {
        const detailsStr = err.details
          .map((d: any) => {
            const field = d.loc?.[d.loc.length - 1] || 'field';
            return `${field}: ${d.msg}`;
          })
          .join('; ');
        fullError = `Validation error - ${detailsStr}`;
      }

      setError(fullError);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setError(null);
      setLoading(true);

      const currentTask = taskList.find((t) => t.id === taskId);
      const oldStatus = currentTask?.status;

      await tasks.updateStatus(taskId, newStatus, { old_status: oldStatus });

      await loadData();
    } catch (err: any) {
      console.error('Failed to update task status:', err);
      setError(err?.message || 'Failed to update task status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      setError(null);
      setLoading(true);

      await tasks.delete(taskId);

      await loadData();
    } catch (err: any) {
      console.error('Failed to delete task:', err);
      setError(err?.message || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        shelf_id: task.shelf_id || '',
        priority: task.priority || 5,
        description: task.description || '',
        zone_id: task.zone_id || '',
        task_type: (task.task_type as any) || 'PICKUP_AND_DELIVER',
        target_shelf_id: task.target_shelf_id,
        target_zone_id: task.target_zone_id,
      });
    } else {
      setEditingTask(null);
      setFormData(initialFormData);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTask(null);
    setError(null);
    setFormData(initialFormData);
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400';
      case 'ASSIGNED':
      case 'MOVING_TO_PICKUP':
      case 'MOVING_TO_DROP':
        return 'bg-blue-500/20 text-blue-400';
      case 'ERROR':
      case 'CANCELLED':
        return 'bg-red-500/20 text-red-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      case 'ASSIGNED':
      case 'MOVING_TO_PICKUP':
      case 'MOVING_TO_DROP':
        return <Zap className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'ERROR':
      case 'CANCELLED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-100">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-300 hover:text-red-200 font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Tasks</h1>
          <p className="text-accent">Manage robot task assignments and monitor progress</p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-bold shadow-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-card/80 border border-border/30">
            <div className="text-xs text-muted-foreground mb-2">Total Tasks</div>
            <p className="text-2xl font-bold text-primary">{stats.tasks.total}</p>
          </div>

          <div className="p-4 rounded-lg bg-card/80 border border-border/30">
            <div className="text-xs text-muted-foreground mb-2">In Progress</div>
            <p className="text-2xl font-bold text-primary">{stats.tasks.in_progress}</p>
          </div>

          <div className="p-4 rounded-lg bg-card/80 border border-border/30">
            <div className="text-xs text-muted-foreground mb-2">Completed</div>
            <p className="text-2xl font-bold text-primary">{stats.tasks.completed}</p>
          </div>

          <div className="p-4 rounded-lg bg-card/80 border border-border/30">
            <div className="text-xs text-muted-foreground mb-2">Available Robots</div>
            <p className="text-2xl font-bold text-primary">{stats.robots.available}/{stats.robots.total}</p>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {loading && taskList.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground mt-3">Loading tasks...</p>
          </div>
        ) : taskList.length === 0 ? (
          <div className="text-center py-12 bg-card/50 rounded-lg border border-border/30">
            <p className="text-muted-foreground text-lg">No tasks yet</p>
          </div>
        ) : (
          taskList.map((task) => {
            const shelf = shelfList.find((s) => s.id === task.shelf_id);
            const zone = zoneList.find((z) => z.id === task.zone_id);

            return (
              <div
                key={task.id}
                className="p-4 rounded-lg bg-card/80 border border-border/30 hover:border-primary/30 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-bold text-foreground">
                        {TASK_TYPES.find((t) => t.value === task.task_type)?.label || task.task_type}
                      </h3>
                      <span
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-sm font-semibold ${getStatusColor(task.status)}`}
                      >
                        {getStatusIcon(task.status)}
                        <span>{task.status}</span>
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Shelf: {shelf?.warehouse_id} (Level {shelf?.level}) {zone && `→ Zone: ${zone.name}`}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary mb-2">Priority: {task.priority}/10</div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={loading}
                        className="px-2 py-1 rounded text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Transitions */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/30">
                  {TASK_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(task.id, status)}
                      disabled={loading || status === task.status}
                      className={`text-xs px-2 py-1 rounded transition ${
                        status === task.status
                          ? 'bg-primary/30 text-primary font-bold'
                          : 'bg-card/50 text-muted-foreground hover:bg-card/70'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-md w-full border border-border/30 max-h-[90vh] overflow-y-auto">
            <div className="bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30 sticky top-0">
              <h2 className="text-2xl font-bold">Create Task</h2>
              <button
                onClick={closeModal}
                disabled={loading}
                className="hover:bg-secondary/50 p-2 rounded-lg transition disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Task Type *
                </label>
                <select
                  value={formData.task_type}
                  onChange={(e) =>
                    setFormData({ ...formData, task_type: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                >
                  {TASK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shelf */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Shelf *
                </label>
                <select
                  value={formData.shelf_id}
                  onChange={(e) =>
                    setFormData({ ...formData, shelf_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  required
                >
                  <option value="">Select a shelf</option>
                  {shelfList.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.warehouse_id} (Level {shelf.level})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zone (for PICKUP_AND_DELIVER) */}
              {formData.task_type === 'PICKUP_AND_DELIVER' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Drop Zone *
                  </label>
                  <select
                    value={formData.zone_id}
                    onChange={(e) =>
                      setFormData({ ...formData, zone_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                    required
                  >
                    <option value="">Select a zone</option>
                    {zoneList.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Shelf (for MOVE_SHELF) */}
              {formData.task_type === 'MOVE_SHELF' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Target Shelf *
                  </label>
                  <select
                    value={formData.target_shelf_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, target_shelf_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                    required
                  >
                    <option value="">Select target shelf</option>
                    {shelfList.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        {shelf.warehouse_id} (Level {shelf.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Zone (for REPOSITION) */}
              {formData.task_type === 'REPOSITION' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Target Zone *
                  </label>
                  <select
                    value={formData.target_zone_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, target_zone_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                    required
                  >
                    <option value="">Select target zone</option>
                    {zoneList.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Priority (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  rows={3}
                  placeholder="Optional task description"
                />
              </div>

              {/* Form Actions */}
              <div className="flex space-x-3 pt-4 border-t border-border/30">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg font-bold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30 disabled:opacity-50"
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