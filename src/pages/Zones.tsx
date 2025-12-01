import { useEffect, useState } from 'react';
import { Plus, X, MapPin } from 'lucide-react';
import { zones } from '../services/api';

export default function Zones() {
  const [zoneList, setZoneList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ zone_id: '', name: '', x: '0', y: '0', yaw: '0' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const data = await zones.list();
      setZoneList(Array.isArray(data) ? data : data.results || []);
      setErrorMsg(null);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZoneList([]);
      // Present a friendly message to the user (do not surface raw HTML)
      const err: any = error;
      if (err?.details?.status >= 500) {
        setErrorMsg('Server error while loading zones. Check server logs.');
      } else if (err?.details?.message) {
        setErrorMsg(String(err.details.message));
      } else {
        setErrorMsg(err?.message || 'Failed to load zones');
      }
    }
  };

  const openModal = () => {
    setFormData({ zone_id: '', name: '', x: '0', y: '0', yaw: '0' });
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      // Ensure we have the latest zones and prevent duplicate zone_id client-side
      try {
        const latest = await zones.list();
        const list = Array.isArray(latest) ? latest : latest.results || [];
        const exists = list.find((z: any) => (z.zone_id || z.zoneId || z.id) === formData.zone_id);
        if (exists) {
          alert(`Zone with id "${formData.zone_id}" already exists.`);
          return;
        }
      } catch (e) {
        // ignore list fetch errors — we'll let the POST handle server-side checks
      }
      const payload = {
        zone_id: formData.zone_id,
        name: formData.name || undefined,
        x: Number(formData.x),
        y: Number(formData.y),
        yaw: Number(formData.yaw || 0),
      };
      await zones.create(payload);
      await loadZones();
      closeModal();
      setErrorMsg(null);
    } catch (error) {
      console.error('Failed to create zone:', error);
      const err: any = error;
      // If backend returned a structured message (e.g. { error: 'zone_exists' }) the api client
      // will set that as the Error.message. Map common cases to friendly UI strings.
      const raw = err?.message || String(error);
      if (raw === 'zone_exists') {
        setErrorMsg(`Zone with id "${formData.zone_id}" already exists.`);
      } else if (err?.details?.status >= 500) {
        setErrorMsg('Server error while creating zone. Check server logs.');
      } else if (err?.details?.message) {
        setErrorMsg(String(err.details.message));
      } else {
        setErrorMsg(raw);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this zone?')) return;
    try {
      await zones.delete(id);
      await loadZones();
    } catch (error) {
      console.error('Failed to delete zone:', error);
      alert('Failed to delete zone');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Zones</h1>
          <p className="text-accent-400">Manage drop / staging zones</p>
        </div>

        <button
          onClick={openModal}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Zone</span>
        </button>
      </div>
      {/* Error banner (sanitized, non-HTML) */}
      {errorMsg && (
        <div className="mt-4 flex items-start justify-between bg-red-900/40 border border-red-700 rounded-lg p-4">
          <div className="text-sm text-red-100">{errorMsg}</div>
          <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-red-100 text-xs font-semibold ml-4">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zoneList.map((z) => (
          <div key={z.id} className="group bg-gradient-card rounded-xl border border-accent-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-primary-500/20 border border-primary-500/30">
                  <MapPin className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{z.name || z.zone_id}</h3>
                  <p className="text-xs text-accent-500">{z.zone_id}</p>
                </div>
              </div>
              <div className="text-xs text-accent-400">X: {Number(z.x).toFixed(2)}, Y: {Number(z.y).toFixed(2)}</div>
            </div>

            <div className="pt-2 text-xs text-accent-500 border-t border-accent-700">Created: {z.created_at ? new Date(z.created_at).toLocaleString() : '—'}</div>

            <div className="flex space-x-2 pt-4">
              <button
                onClick={() => handleDelete(z.id)}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-xs font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-card rounded-2xl shadow-neo max-w-md w-full border border-accent-700">
            <div className="bg-accent-800/80 text-white p-6 flex items-center justify-between border-b border-accent-700 rounded-t-2xl">
              <h2 className="text-2xl font-bold">New Zone</h2>
              <button onClick={closeModal} className="p-2 hover:bg-accent-700 rounded-lg transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-accent-200 mb-2">Zone ID *</label>
                <input
                  required
                  value={formData.zone_id}
                  onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-accent-200 mb-2">Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={formData.x}
                  onChange={(e) => setFormData({ ...formData, x: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white"
                  placeholder="x"
                />
                <input
                  type="number"
                  step="0.1"
                  value={formData.y}
                  onChange={(e) => setFormData({ ...formData, y: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white"
                  placeholder="y"
                />
                <input
                  type="number"
                  step="0.1"
                  value={formData.yaw}
                  onChange={(e) => setFormData({ ...formData, yaw: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white"
                  placeholder="yaw"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition">Create Zone</button>
                <button type="button" onClick={closeModal} className="px-6 py-3 bg-accent-700/50 text-accent-300 rounded-lg font-semibold hover:bg-accent-700 transition border border-accent-600">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
