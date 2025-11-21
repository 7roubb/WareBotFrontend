import { useEffect, useState } from 'react';
import { Grid, Plus, Edit, Trash2, X } from 'lucide-react';
import { shelves } from '../services/api';

export default function Shelves() {
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShelf, setEditingShelf] = useState<any>(null);
  const [formData, setFormData] = useState({
    warehouse_id: '',
    x_coord: 0,
    y_coord: 0,
    level: 1,
    available: true,
    status: 'IDLE',
  });

  useEffect(() => {
    loadShelves();
  }, []);

  const loadShelves = async () => {
    const data = await shelves.list();
    setShelfList(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShelf) {
        await shelves.update(editingShelf.id, formData);
      } else {
        await shelves.create(formData);
      }
      loadShelves();
      closeModal();
    } catch (error) {
      console.error('Failed to save shelf:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this shelf?')) {
      await shelves.delete(id);
      loadShelves();
    }
  };

  const openModal = (shelf?: any) => {
    if (shelf) {
      setEditingShelf(shelf);
      setFormData({
        warehouse_id: shelf.warehouse_id,
        x_coord: shelf.x_coord,
        y_coord: shelf.y_coord,
        level: shelf.level,
        available: shelf.available,
        status: shelf.status,
      });
    } else {
      setEditingShelf(null);
      setFormData({
        warehouse_id: '',
        x_coord: 0,
        y_coord: 0,
        level: 1,
        available: true,
        status: 'IDLE',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingShelf(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Shelves</h1>
          <p className="text-accent-400">Organize and manage warehouse inventory storage</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Shelf</span>
        </button>
      </div>

      {/* Shelves Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {shelfList.map((shelf) => (
          <div
            key={shelf.id}
            className="group bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500 hover:shadow-neo transition duration-300"
          >
            {/* Header */}
            <div className="bg-accent-800/50 p-6 border-b border-accent-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                    <Grid className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      ({shelf.x_coord}, {shelf.y_coord})
                    </h3>
                    <p className="text-xs text-accent-500">Level {shelf.level}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-accent-400">Status: </span>
                <span className="font-bold text-primary-300">{shelf.status}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Warehouse</div>
                  <p className="text-lg font-bold text-primary-300">{shelf.warehouse_id}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <div className="text-xs text-accent-400 mb-1">Availability</div>
                  <p className="text-lg font-bold text-primary-300">
                    {shelf.available ? 'Available' : 'Occupied'}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  onClick={() => openModal(shelf)}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 hover:bg-primary-500/30 transition flex items-center justify-center space-x-1"
                >
                  <Edit className="w-4 h-4" />
                  <span className="text-sm">Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(shelf.id)}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-card rounded-xl shadow-neo max-w-md w-full border border-accent-700">
            <div className="bg-accent-800/80 text-white p-6 flex items-center justify-between border-b border-accent-700">
              <h2 className="text-2xl font-bold">
                {editingShelf ? 'Edit Shelf' : 'Add Shelf'}
              </h2>
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
                  Warehouse ID *
                </label>
                <input
                  type="text"
                  value={formData.warehouse_id}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-accent-300 mb-2">
                    X Coordinate *
                  </label>
                  <input
                    type="number"
                    value={formData.x_coord}
                    onChange={(e) =>
                      setFormData({ ...formData, x_coord: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent-300 mb-2">
                    Y Coordinate *
                  </label>
                  <input
                    type="number"
                    value={formData.y_coord}
                    onChange={(e) =>
                      setFormData({ ...formData, y_coord: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Level *
                </label>
                <input
                  type="number"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-accent-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-accent-700 rounded-lg bg-accent-800/50 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                >
                  <option value="IDLE">IDLE</option>
                  <option value="BUSY">BUSY</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.available}
                  onChange={(e) =>
                    setFormData({ ...formData, available: e.target.checked })
                  }
                  className="w-5 h-5 text-primary-500 rounded focus:ring-2 focus:ring-primary-500/50"
                />
                <label className="ml-3 text-sm font-medium text-accent-300">
                  Available
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition"
                >
                  {editingShelf ? 'Update Shelf' : 'Create Shelf'}
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
