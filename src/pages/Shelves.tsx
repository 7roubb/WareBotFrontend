// Shelves.tsx - FIXED VERSION with proper endpoint usage and WebSocket

import { useEffect, useState } from 'react';
import { Grid, Plus, Edit, Trash2, X, Package, AlertCircle, MapPin, Eye } from 'lucide-react';
import type { Shelf, ShelfCreate, ShelfUpdate, Product } from '@/types';
import { shelves } from '../services/api';
import { connectWebSocket } from '../services/websocket';

interface FormData {
  warehouse_id: string;
  current_x: number;
  current_y: number;
  current_yaw: number;
  level: number;
  available: boolean;
  status: 'IDLE' | 'BUSY' | 'ERROR' | 'OFFLINE';
  storage_x: number | undefined;
  storage_y: number | undefined;
  storage_yaw: number | undefined;
}

export default function Shelves() {
  const [shelfList, setShelfList] = useState<Shelf[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [shelfProducts, setShelfProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initialFormData: FormData = {
    warehouse_id: '',
    current_x: 0,
    current_y: 0,
    current_yaw: 0,
    level: 1,
    available: true,
    status: 'IDLE',
    storage_x: undefined,
    storage_y: undefined,
    storage_yaw: undefined,
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);

  useEffect(() => {
    loadShelves();

    const socket = connectWebSocket();
    if (socket) {
      // ✓ Subscribe to shelf updates
      socket.emit("subscribe_shelves");

      // Listen for shelf metadata updates
      socket.on('shelf_update', (data: any) => {
        console.log('[Shelves] WebSocket shelf_update received:', data);
        setShelfList((prev) =>
          prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
        );
      });

      // Listen for shelf location updates specifically
      socket.on('shelf_location_update', (data: any) => {
        console.log('[Shelves] WebSocket shelf_location_update received:', data);
        setShelfList((prev) =>
          prev.map((s) =>
            s.id === data.id
              ? {
                  ...s,
                  current_x: data.current_x,
                  current_y: data.current_y,
                  current_yaw: data.current_yaw,
                }
              : s
          )
        );

        // Update detail modal if it's open
        if (selectedShelf?.id === data.id) {
          setSelectedShelf((prev) =>
            prev
              ? {
                  ...prev,
                  current_x: data.current_x,
                  current_y: data.current_y,
                  current_yaw: data.current_yaw,
                }
              : null
          );
        }
      });

      // Listen for shelf deletion
      socket.on('shelf_deleted', (data: any) => {
        console.log('[Shelves] WebSocket shelf_deleted received:', data);
        setShelfList((prev) => prev.filter((s) => s.id !== data.id));
      });
    }

    return () => {
      if (socket) {
        socket.off('shelf_update');
        socket.off('shelf_location_update');
        socket.off('shelf_deleted');
      }
    };
  }, [selectedShelf?.id]);

  const loadShelves = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await shelves.list();
      const shelfArray = Array.isArray(data) ? data : [];

      console.log('[DEBUG] Shelves API response:', shelfArray);
      if (shelfArray.length === 0) {
        console.log('[DEBUG] No shelves returned from API');
      } else {
        shelfArray.forEach((s) => {
          console.log(
            `  [DEBUG] ${s.warehouse_id}: current=(${s.current_x}, ${s.current_y}), storage=(${s.storage_x}, ${s.storage_y}), yaw=${s.current_yaw ?? 'N/A'}`
          );
        });
      }

      setShelfList(shelfArray);
    } catch (err: any) {
      console.error('[DEBUG] Failed to load shelves:', err);
      setError(err?.message || 'Failed to load shelves');
      setShelfList([]);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.warehouse_id || formData.warehouse_id.trim() === '') {
      return 'Warehouse ID is required';
    }
    if (formData.warehouse_id.length > 100) {
      return 'Warehouse ID must be 100 characters or less';
    }

    if (isNaN(Number(formData.current_x))) {
      return 'Current X must be a valid number';
    }

    if (isNaN(Number(formData.current_y))) {
      return 'Current Y must be a valid number';
    }

    if (isNaN(Number(formData.current_yaw))) {
      return 'Current Yaw must be a valid number';
    }

    if (isNaN(Number(formData.level)) || Number(formData.level) < 0) {
      return 'Level must be a non-negative number';
    }

    const validStatuses = ['IDLE', 'BUSY', 'ERROR', 'OFFLINE'];
    if (!validStatuses.includes(formData.status)) {
      return `Status must be one of: ${validStatuses.join(', ')}`;
    }

    const hasStorageX = formData.storage_x !== undefined;
    const hasStorageY = formData.storage_y !== undefined;

    if (hasStorageX && !hasStorageY) {
      return 'If Storage X is provided, Storage Y must also be provided';
    }
    if (!hasStorageX && hasStorageY) {
      return 'If Storage Y is provided, Storage X must also be provided';
    }

    if (hasStorageX && isNaN(Number(formData.storage_x))) {
      return 'Storage X must be a valid number';
    }

    if (hasStorageY && isNaN(Number(formData.storage_y))) {
      return 'Storage Y must be a valid number';
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

      if (editingShelf) {
        // ===== EDITING EXISTING SHELF =====
        console.log('[Shelves] Editing shelf:', editingShelf.id);

        // Step 1: Update metadata (warehouse_id, level, available, status)
        const updateData: ShelfUpdate = {};

        if (formData.warehouse_id !== editingShelf.warehouse_id) {
          updateData.warehouse_id = formData.warehouse_id.trim();
        }
        if (formData.level !== editingShelf.level) {
          updateData.level = Number(Math.floor(formData.level));
        }
        if (formData.available !== editingShelf.available) {
          updateData.available = Boolean(formData.available);
        }
        if (formData.status !== editingShelf.status) {
          updateData.status = formData.status;
        }

        if (Object.keys(updateData).length > 0) {
          console.log('[Shelves] Updating metadata:', updateData);
          await shelves.update(editingShelf.id, updateData);
        }

        // Step 2: Update current location (if changed)
        const currentLocChanged =
          formData.current_x !== editingShelf.current_x ||
          formData.current_y !== editingShelf.current_y ||
          formData.current_yaw !== editingShelf.current_yaw;

        if (currentLocChanged) {
          console.log('[Shelves] Updating current location');
          await shelves.updateCurrentLocation(editingShelf.id, {
            current_x: Number(formData.current_x),
            current_y: Number(formData.current_y),
            current_yaw: Number(formData.current_yaw) || 0.0,
          });
        }

        // Step 3: Update storage location (if changed)
        const storageLocChanged =
          formData.storage_x !== editingShelf.storage_x ||
          formData.storage_y !== editingShelf.storage_y ||
          formData.storage_yaw !== editingShelf.storage_yaw;

        if (
          storageLocChanged &&
          formData.storage_x !== undefined &&
          formData.storage_y !== undefined
        ) {
          console.log('[Shelves] Updating storage location');
          await shelves.setStorageLocation(editingShelf.id, {
            storage_x: Number(formData.storage_x),
            storage_y: Number(formData.storage_y),
            storage_yaw: Number(formData.storage_yaw) || 0.0,
          });
        }
      } else {
        // ===== CREATING NEW SHELF =====
        console.log('[Shelves] Creating new shelf');

        const submitData: ShelfCreate = {
          warehouse_id: formData.warehouse_id.trim(),
          current_x: Number(formData.current_x),
          current_y: Number(formData.current_y),
          current_yaw: Number(formData.current_yaw) || 0.0,
          level: Number(Math.floor(formData.level)),
          available: Boolean(formData.available),
          status: formData.status,
        };

        // Only include storage if both provided
        if (
          formData.storage_x !== undefined &&
          formData.storage_y !== undefined
        ) {
          submitData.storage_x = Number(formData.storage_x);
          submitData.storage_y = Number(formData.storage_y);
          submitData.storage_yaw = formData.storage_yaw
            ? Number(formData.storage_yaw)
            : 0.0;
        }

        console.log('[Shelves] Submitting payload:', JSON.stringify(submitData, null, 2));

        const createdShelf = await shelves.create(submitData);

        // DEBUG: Verify location was saved
        console.log('[Shelves] ✓ Shelf created successfully!');
        console.log('[Shelves] Response from server:');
        console.log(`  - current_x: ${createdShelf.current_x}`);
        console.log(`  - current_y: ${createdShelf.current_y}`);
        console.log(`  - storage_x: ${createdShelf.storage_x}`);
        console.log(`  - storage_y: ${createdShelf.storage_y}`);

        if (
          createdShelf.current_x === 0 &&
          createdShelf.current_y === 0 &&
          submitData.current_x !== 0 &&
          submitData.current_y !== 0
        ) {
          console.warn('[Shelves] ⚠️ WARNING: Location reset to 0,0!');
          console.warn(
            '[Shelves] We sent: (',
            submitData.current_x,
            ',',
            submitData.current_y,
            ')'
          );
          console.warn(
            '[Shelves] But server returned: (',
            createdShelf.current_x,
            ',',
            createdShelf.current_y,
            ')'
          );
          setError('⚠️ Location not saved correctly! Check console for details.');
        }
      }

      await loadShelves();
      closeModal();
    } catch (err: any) {
      console.error('[Shelves] Error:', err);

      let fullError = err?.message || 'Failed to save shelf';

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shelf?')) {
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await shelves.delete(id);
      await loadShelves();
    } catch (err: any) {
      console.error('Failed to delete shelf:', err);
      setError(err?.message || 'Failed to delete shelf');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocation = async (shelf: Shelf) => {
    try {
      setError(null);
      setLoading(true);

      console.log('[Shelves] Restoring shelf to storage location:', shelf.id);
      console.log(`  Current location: (${shelf.current_x}, ${shelf.current_y})`);
      console.log(`  Storage location: (${shelf.storage_x}, ${shelf.storage_y})`);

      const result = await shelves.restoreToStorage(shelf.id);

      console.log('[Shelves] ✓ Restore successful!', result);

      // Reload to see the change
      await loadShelves();

      if (selectedShelf?.id === shelf.id) {
        const updated = shelfList.find((s) => s.id === shelf.id);
        if (updated) {
          setSelectedShelf(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to restore shelf:', err);
      setError(err?.message || 'Failed to restore shelf to storage location');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (shelf?: Shelf) => {
    if (shelf) {
      setEditingShelf(shelf);
      setFormData({
        warehouse_id: shelf.warehouse_id || '',
        current_x: shelf.current_x || 0,
        current_y: shelf.current_y || 0,
        current_yaw: shelf.current_yaw || 0,
        level: shelf.level || 1,
        available: shelf.available !== undefined ? shelf.available : true,
        status: shelf.status || 'IDLE',
        storage_x: shelf.storage_x,
        storage_y: shelf.storage_y,
        storage_yaw: shelf.storage_yaw,
      });
    } else {
      setEditingShelf(null);
      setFormData(initialFormData);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingShelf(null);
    setError(null);
    setFormData(initialFormData);
  };

  const openDetailModal = async (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setLoadingProducts(true);
    try {
      setError(null);
      const products = await shelves.getProducts(shelf.id);
      setShelfProducts(Array.isArray(products) ? products : []);
    } catch (err: any) {
      console.error('Failed to load shelf products:', err);
      setError(err?.message || 'Failed to load shelf products');
      setShelfProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedShelf(null);
    setShelfProducts([]);
    setError(null);
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
          <h1 className="text-4xl font-bold text-white mb-2">Shelves</h1>
          <p className="text-accent">Organize and manage warehouse inventory storage</p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-bold shadow-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>Add Shelf</span>
        </button>
      </div>

      {/* Shelves Grid */}
      <div className="data-grid">
        {loading && shelfList.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground mt-3">Loading shelves...</p>
          </div>
        ) : shelfList.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Grid className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">No shelves yet</p>
          </div>
        ) : (
          shelfList.map((shelf) => (
            <div
              key={shelf.id}
              onClick={() => {
                openDetailModal(shelf);
                setShowDetailModal(true);
              }}
              className="group bg-card/80 backdrop-blur rounded-xl border border-border/30 shadow-md overflow-hidden hover:border-primary/30 hover:shadow-lg transition duration-300 cursor-pointer"
            >
              {/* Header */}
              <div className="bg-card/50 p-4 border-b border-border/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">
                        ({shelf.current_x?.toFixed(2) || '0.00'}, {shelf.current_y?.toFixed(2) || '0.00'})
                      </h3>
                      <p className="text-xs text-muted-foreground">Level {shelf.level}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <span
                    className={`font-bold text-sm px-2 py-1 rounded ${
                      shelf.status === 'IDLE'
                        ? 'bg-green-500/20 text-green-400'
                        : shelf.status === 'BUSY'
                        ? 'bg-blue-500/20 text-blue-400'
                        : shelf.status === 'ERROR'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {shelf.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {shelf.april_tag_url && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(shelf.april_tag_url, '_blank');
                    }}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition w-fit text-xs"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 64 64"
                      className="w-5 h-5"
                    >
                      <defs>
                        <linearGradient id="goldA" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F8E47A" />
                          <stop offset="50%" stopColor="#F5D742" />
                          <stop offset="100%" stopColor="#E8C93B" />
                        </linearGradient>
                      </defs>
                      <rect x="4" y="4" width="56" height="56" rx="10" fill="none" stroke="url(#goldA)" strokeWidth="3" />
                      <rect x="10" y="10" width="14" height="14" rx="3" fill="none" stroke="url(#goldA)" strokeWidth="3"/>
                      <rect x="14" y="14" width="6" height="6" rx="1" fill="url(#goldA)" />
                      <rect x="40" y="10" width="14" height="14" rx="3" fill="none" stroke="url(#goldA)" strokeWidth="3"/>
                      <rect x="44" y="14" width="6" height="6" rx="1" fill="url(#goldA)" />
                      <rect x="10" y="40" width="14" height="14" rx="3" fill="none" stroke="url(#goldA)" strokeWidth="3"/>
                      <rect x="14" y="44" width="6" height="6" rx="1" fill="url(#goldA)" />
                      <rect x="30" y="30" width="6" height="6" fill="url(#goldA)" rx="2" />
                    </svg>
                    <span className="text-primary text-xs">View Tag</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">Warehouse</div>
                    <p className="text-sm font-bold text-primary">{shelf.warehouse_id}</p>
                  </div>

                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">Available</div>
                    <p className="text-sm font-bold text-primary">
                      {shelf.available ? '✓ Yes' : '✗ No'}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-1 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(shelf);
                    }}
                    disabled={loading}
                    className="flex-1 px-2 py-1 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition flex items-center justify-center space-x-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(shelf.id);
                    }}
                    disabled={loading}
                    className="flex-1 px-2 py-1 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive hover:bg-destructive/30 transition flex items-center justify-center space-x-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-md w-full border border-border/30 max-h-[90vh] overflow-y-auto">
            <div className="bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30 sticky top-0">
              <h2 className="text-2xl font-bold">
                {editingShelf ? 'Edit Shelf' : 'Add Shelf'}
              </h2>
              <button
                onClick={closeModal}
                disabled={loading}
                className="hover:bg-secondary/50 p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Warehouse ID * <span className="text-xs text-muted-foreground">(1-100 chars)</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.warehouse_id}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_id: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="e.g., WH001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Position *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">X</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.current_x}
                      onChange={(e) =>
                        setFormData({ ...formData, current_x: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Y</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.current_y}
                      onChange={(e) =>
                        setFormData({ ...formData, current_y: Number(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Yaw <span className="text-xs text-muted-foreground">(0-360°, optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.current_yaw}
                  onChange={(e) =>
                    setFormData({ ...formData, current_yaw: Number(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Level * <span className="text-xs text-muted-foreground">(≥ 0)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: Number(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'IDLE' | 'BUSY' | 'ERROR' | 'OFFLINE',
                    })
                  }
                  className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                >
                  <option value="IDLE">IDLE</option>
                  <option value="BUSY">BUSY</option>
                  <option value="ERROR">ERROR</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>

              <div className="flex items-center p-3 rounded-lg bg-card/50 border border-border/30">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) =>
                    setFormData({ ...formData, available: e.target.checked })
                  }
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/50"
                />
                <label htmlFor="available" className="ml-3 text-sm font-medium text-foreground">
                  Available
                </label>
              </div>

              <div className="border-t border-border/30 pt-4">
                <p className="text-xs text-muted-foreground mb-3 font-semibold">
                  Storage Location (optional - provide both X and Y)
                </p>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Storage X</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.storage_x ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          storage_x: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Storage Y</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.storage_y ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          storage_y: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Storage Yaw</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.storage_yaw ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storage_yaw: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-border/30 rounded-lg bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/50 transition"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-border/30">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg font-bold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingShelf ? 'Update Shelf' : 'Create Shelf'}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal - SAME AS BEFORE */}
      {showDetailModal && selectedShelf && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-2xl w-full border border-border/30 max-h-[80vh] overflow-y-auto">
            <div className="bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30 sticky top-0">
              <div>
                <h2 className="text-2xl font-bold">
                  Shelf ({selectedShelf.current_x?.toFixed(2)}, {selectedShelf.current_y?.toFixed(2)})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Level {selectedShelf.level} • {selectedShelf.warehouse_id}</p>
              </div>
              <button
                onClick={closeDetailModal}
                className="hover:bg-secondary/50 p-2 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2">Warehouse</div>
                  <p className="text-lg font-bold text-primary">{selectedShelf.warehouse_id}</p>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2">Status</div>
                  <p className="text-lg font-bold text-primary">{selectedShelf.status}</p>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2">Available</div>
                  <p className="text-lg font-bold text-primary">
                    {selectedShelf.available ? 'Yes' : 'No'}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2">Products</div>
                  <p className="text-lg font-bold text-primary">{shelfProducts.length}</p>
                </div>
              </div>

              {/* Location Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2 font-semibold">Current Position</div>
                  <p className="text-sm font-bold text-primary mb-1">
                    X: {selectedShelf.current_x?.toFixed(2) || 'N/A'}
                  </p>
                  <p className="text-sm font-bold text-primary mb-1">
                    Y: {selectedShelf.current_y?.toFixed(2) || 'N/A'}
                  </p>
                  {selectedShelf.current_yaw !== undefined && (
                    <p className="text-sm text-primary/80">
                      Yaw: {selectedShelf.current_yaw.toFixed(2)}°
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2 font-semibold">Storage Location</div>
                  <p className="text-sm font-bold text-primary mb-1">
                    X: {selectedShelf.storage_x?.toFixed(2) || 'N/A'}
                  </p>
                  <p className="text-sm font-bold text-primary mb-1">
                    Y: {selectedShelf.storage_y?.toFixed(2) || 'N/A'}
                  </p>
                  {selectedShelf.storage_yaw !== undefined && (
                    <p className="text-sm text-primary/80">
                      Yaw: {selectedShelf.storage_yaw.toFixed(2)}°
                    </p>
                  )}
                </div>
              </div>

              {/* Restore Button */}
              {selectedShelf.current_x !== selectedShelf.storage_x ||
              selectedShelf.current_y !== selectedShelf.storage_y ? (
                <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                  <p className="text-sm text-yellow-200 mb-3">
                    Shelf is at a different location than storage. You can restore it:
                  </p>
                  <button
                    onClick={() => handleRestoreLocation(selectedShelf)}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-yellow-500/30 text-yellow-200 rounded-lg font-semibold hover:bg-yellow-500/40 transition disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-500/50"
                  >
                    🔄 Restore to Storage Location
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/30">
                  <p className="text-sm text-green-200">
                    ✓ Shelf is at storage location
                  </p>
                </div>
              )}

              {/* Products */}
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4 flex items-center space-x-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span>Shelf Contents ({shelfProducts.length})</span>
                </h3>

                {loadingProducts ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin">
                      <Package className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground mt-3">Loading products...</p>
                  </div>
                ) : shelfProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-lg">This shelf is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shelfProducts.map((product, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border/30 bg-card/50 hover:border-primary/30 transition"
                      >
                        <h4 className="font-bold text-foreground mb-2">
                          {product.name || 'Unknown Product'}
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {product.sku && (
                            <div>
                              <span className="text-muted-foreground block text-xs">SKU</span>
                              <p className="text-primary font-semibold">{product.sku}</p>
                            </div>
                          )}

                          {product.quantity !== undefined && (
                            <div>
                              <span className="text-muted-foreground block text-xs">Qty</span>
                              <p className="text-primary font-semibold">{product.quantity}</p>
                            </div>
                          )}

                          {product.category && (
                            <div>
                              <span className="text-muted-foreground block text-xs">Category</span>
                              <p className="text-primary font-semibold">{product.category}</p>
                            </div>
                          )}

                          {product.price && (
                            <div>
                              <span className="text-muted-foreground block text-xs">Price</span>
                              <p className="text-primary font-semibold">${product.price}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card/50 border-t border-border/30 p-6 sticky bottom-0">
              <button
                onClick={closeDetailModal}
                className="w-full px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}