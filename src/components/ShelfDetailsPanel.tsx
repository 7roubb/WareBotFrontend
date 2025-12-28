/**
 * Shelf details panel - shows storage and current positions
 * Provides restore-to-storage and admin set-storage actions
 */
import React, { useState } from 'react';
import { X, Lock, MapPin, RotateCcw, Settings } from 'lucide-react';
import { ShelfMap } from '../types/map';
import { mapApi } from '../api/mapApi';
import { useMapContext } from '../context/MapContext';

interface ShelfDetailsPanelProps {
  shelf: ShelfMap;
  onClose: () => void;
}

export function ShelfDetailsPanel({ shelf, onClose }: ShelfDetailsPanelProps) {
  const { setShelf } = useMapContext();
  const [isRestoring, setIsRestoring] = useState(false);
  const [showStorageForm, setShowStorageForm] = useState(false);
  const [storageCoords, setStorageCoords] = useState({
    storage_x: shelf.storage.x,
    storage_y: shelf.storage.y,
    storage_yaw: shelf.storage.yaw || 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDifferent =
    shelf.current.x !== shelf.storage.x || shelf.current.y !== shelf.storage.y;

  const handleRestore = async () => {
    if (!isDifferent) {
      setSuccess('Shelf is already at storage location');
      return;
    }

    setIsRestoring(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await mapApi.restoreShelfToStorage(shelf.id);
      setShelf(updated);
      setSuccess('Shelf restored to storage location');
    } catch (err: any) {
      setError(err.message || 'Failed to restore shelf');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSetStorage = async () => {
    setError(null);
    setSuccess(null);

    const confirmed = window.confirm(
      'This will permanently set the shelf storage location. This action cannot be undone. Are you sure?'
    );
    if (!confirmed) return;

    try {
      const updated = await mapApi.setShelfStorage(shelf.id, storageCoords);
      setShelf(updated);
      setShowStorageForm(false);
      setSuccess('Shelf storage location updated');
    } catch (err: any) {
      setError(err.message || 'Failed to set storage location');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-40">
      {/* Header */}
      <div className="bg-slate-700 px-4 py-3 flex items-center justify-between rounded-t-lg border-b border-slate-600">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white">Shelf {shelf.id}</h3>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-slate-600 p-1 rounded transition"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Status badge */}
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                shelf.location_status === 'STORED'
                  ? '#22c55e'
                  : shelf.location_status === 'IN_TRANSIT'
                    ? '#f97316'
                    : shelf.location_status === 'AT_DROP_ZONE'
                      ? '#ef4444'
                      : shelf.location_status === 'RESTORED_TO_STORAGE'
                        ? '#3b82f6'
                        : '#64748b',
            }}
          />
          <span className="text-sm text-slate-300">{shelf.location_status}</span>
        </div>

        {/* Storage location (immutable) */}
        <div className="bg-slate-900/50 p-3 rounded border border-slate-600">
          <div className="flex items-center space-x-2 mb-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase">Storage (Immutable)</span>
          </div>
          <div className="text-sm text-slate-200 space-y-1 font-mono">
            <p>X: {shelf.storage.x.toFixed(2)}</p>
            <p>Y: {shelf.storage.y.toFixed(2)}</p>
            {shelf.storage.yaw !== undefined && <p>Yaw: {shelf.storage.yaw.toFixed(2)}°</p>}
          </div>
        </div>

        {/* Current location (mutable) */}
        <div className="bg-slate-900/50 p-3 rounded border border-slate-600">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase">Current Position</span>
          </div>
          <div className="text-sm text-slate-200 space-y-1 font-mono">
            <p>X: {shelf.current.x.toFixed(2)}</p>
            <p>Y: {shelf.current.y.toFixed(2)}</p>
            {shelf.current.yaw !== undefined && <p>Yaw: {shelf.current.yaw.toFixed(2)}°</p>}
          </div>
        </div>

        {/* Difference indicator */}
        {isDifferent && (
          <div className="bg-amber-900/20 border border-amber-600 px-3 py-2 rounded text-xs text-amber-200">
            ⚠️ Shelf location differs from storage
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 px-3 py-2 rounded text-xs text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/20 border border-green-600 px-3 py-2 rounded text-xs text-green-200">
            ✓ {success}
          </div>
        )}

        {/* Storage form (admin) */}
        {showStorageForm && (
          <div className="bg-slate-900/50 p-3 rounded border border-slate-600 space-y-3">
            <p className="text-xs text-slate-400">Set permanent storage location</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Storage X</label>
              <input
                type="number"
                step="0.1"
                value={storageCoords.storage_x}
                onChange={(e) =>
                  setStorageCoords({ ...storageCoords, storage_x: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Storage Y</label>
              <input
                type="number"
                step="0.1"
                value={storageCoords.storage_y}
                onChange={(e) =>
                  setStorageCoords({ ...storageCoords, storage_y: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Storage Yaw (optional)</label>
              <input
                type="number"
                step="0.1"
                value={storageCoords.storage_yaw}
                onChange={(e) =>
                  setStorageCoords({ ...storageCoords, storage_yaw: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleSetStorage}
                className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition"
              >
                Confirm Update
              </button>
              <button
                onClick={() => setShowStorageForm(false)}
                className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showStorageForm && (
          <div className="flex space-x-2 pt-2">
            {isDifferent && (
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded text-sm font-semibold transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
              </button>
            )}
            <button
              onClick={() => setShowStorageForm(true)}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-semibold transition"
            >
              <Settings className="w-4 h-4" />
              <span>Admin</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
