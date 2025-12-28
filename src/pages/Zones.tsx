import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Layers, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Zone, ZoneCreate, ZoneUpdate } from '@/types';

interface FormData {
  zone_id: string;
  name: string;
  x: number | '';
  y: number | '';
  yaw: number | '';
}

interface FormErrors {
  zone_id?: string;
  name?: string;
  x?: string;
  y?: string;
  yaw?: string;
}

export default function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<FormData>({
    zone_id: '',
    name: '',
    x: '',
    y: '',
    yaw: '',
  });
  const { toast } = useToast();

  // Load zones on component mount
  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/zones', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        // Check if response is HTML (error page from server)
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error('API endpoint not found. Make sure Flask backend is running and zones routes are registered.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load zones');
      }
      
      const data = await response.json();
      const zoneArray = Array.isArray(data) ? data : [];
      console.log('[DEBUG] zones API response:', zoneArray);
      zoneArray.forEach((z: any) => {
        console.log(`  ${z.zone_id}: (${z.x}, ${z.y}), yaw=${z.yaw ?? 'N/A'}`);
      });
      setZones(zoneArray);
    } catch (err: any) {
      console.error('[DEBUG] Error loading zones:', err);
      setError(err.message);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Validate zone_id
    if (!formData.zone_id.trim()) {
      errors.zone_id = 'Zone ID is required';
    } else if (formData.zone_id.trim().length < 1 || formData.zone_id.trim().length > 100) {
      errors.zone_id = 'Zone ID must be 1-100 characters';
    } else if (!editingZone) {
      // Check for duplicate zone_id only when creating
      if (zones.some(z => z.zone_id === formData.zone_id.trim())) {
        errors.zone_id = 'Zone ID must be unique';
      }
    }

    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    // Validate coordinates
    const x = parseFloat(formData.x as string);
    const y = parseFloat(formData.y as string);
    const yaw = parseFloat(formData.yaw as string);

    if (formData.x === '') {
      errors.x = 'X coordinate is required';
    } else if (isNaN(x)) {
      errors.x = 'X must be a valid number';
    }

    if (formData.y === '') {
      errors.y = 'Y coordinate is required';
    } else if (isNaN(y)) {
      errors.y = 'Y must be a valid number';
    }

    if (formData.yaw === '') {
      errors.yaw = 'Yaw is required';
    } else if (isNaN(yaw)) {
      errors.yaw = 'Yaw must be a valid number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        zone_id: formData.zone_id.trim(),
        name: formData.name.trim(),
        x: parseFloat(formData.x as string),
        y: parseFloat(formData.y as string),
        yaw: parseFloat(formData.yaw as string),
      };

      const response = await fetch('/api/zones', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error === 'zone_exists' 
          ? 'Zone ID already exists'
          : errorData.error || 'Failed to create zone';
        throw new Error(errorMsg);
      }

      toast({ title: 'Zone created successfully' });
      setIsDialogOpen(false);
      setEditingZone(null);
      setFormData({ zone_id: '', name: '', x: '', y: '', yaw: '' });
      setFormErrors({});
      await loadZones();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!zoneToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/zones/${zoneToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete zone');
      }

      toast({ title: 'Zone deleted successfully' });
      setDeleteDialogOpen(false);
      setZoneToDelete(null);
      await loadZones();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEdit = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      zone_id: zone.zone_id,
      name: zone.name,
      x: zone.x,
      y: zone.y,
      yaw: zone.yaw,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingZone(null);
    setFormData({ zone_id: '', name: '', x: '', y: '', yaw: '' });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  if (loading) {
    return <LoadingPage text="Loading zones..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Zones"
        description="Manage warehouse zones with coordinates for robot navigation and task routing"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Edit Zone' : 'Add New Zone'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Zone ID */}
              <div className="space-y-2">
                <Label htmlFor="zone_id">Zone ID *</Label>
                <Input
                  id="zone_id"
                  value={formData.zone_id}
                  onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                  placeholder="e.g., ZONE_A, PICKUP_01"
                  disabled={!!editingZone}
                />
                {formErrors.zone_id && (
                  <p className="text-sm text-destructive">{formErrors.zone_id}</p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Storage Area"
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              {/* Coordinates Section */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Zone Coordinates *</p>

                <div className="grid grid-cols-3 gap-3">
                  {/* X Coordinate */}
                  <div className="space-y-2">
                    <Label htmlFor="x" className="text-xs">X</Label>
                    <Input
                      id="x"
                      type="number"
                      step="0.01"
                      value={formData.x}
                      onChange={(e) => setFormData({ ...formData, x: e.target.value ? parseFloat(e.target.value) : '' })}
                      placeholder="0.0"
                    />
                    {formErrors.x && (
                      <p className="text-xs text-destructive">{formErrors.x}</p>
                    )}
                  </div>

                  {/* Y Coordinate */}
                  <div className="space-y-2">
                    <Label htmlFor="y" className="text-xs">Y</Label>
                    <Input
                      id="y"
                      type="number"
                      step="0.01"
                      value={formData.y}
                      onChange={(e) => setFormData({ ...formData, y: e.target.value ? parseFloat(e.target.value) : '' })}
                      placeholder="0.0"
                    />
                    {formErrors.y && (
                      <p className="text-xs text-destructive">{formErrors.y}</p>
                    )}
                  </div>

                  {/* Yaw */}
                  <div className="space-y-2">
                    <Label htmlFor="yaw" className="text-xs">Yaw (°)</Label>
                    <Input
                      id="yaw"
                      type="number"
                      step="0.01"
                      value={formData.yaw}
                      onChange={(e) => setFormData({ ...formData, yaw: e.target.value ? parseFloat(e.target.value) : '' })}
                      placeholder="0.0"
                    />
                    {formErrors.yaw && (
                      <p className="text-xs text-destructive">{formErrors.yaw}</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Define the center position and orientation of this zone for robot navigation
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Zone'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {zones.length === 0 && !error && (
        <EmptyState
          icon={Layers}
          title="No zones yet"
          description="Create zones to define areas in your warehouse for robot navigation and task routing"
        />
      )}

      {zones.length > 0 && !error && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Card key={zone.id} className="glass-card glow-border hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{zone.name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">ID: {zone.zone_id}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Coordinates Display */}
                <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">X</p>
                    <p className="text-sm font-medium">{zone.x.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Y</p>
                    <p className="text-sm font-medium">{zone.y.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Yaw</p>
                    <p className="text-sm font-medium">{zone.yaw.toFixed(2)}°</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="text-xs space-y-1 text-muted-foreground">
                  {zone.created_at && (
                    <p>Created: {new Date(zone.created_at).toLocaleDateString()}</p>
                  )}
                  {zone.deleted && (
                    <p className="text-destructive font-medium">Deleted: {zone.deleted_at ? new Date(zone.deleted_at).toLocaleDateString() : 'Unknown'}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(zone)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setZoneToDelete(zone.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this zone? This action cannot be undone. Tasks associated with this zone may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Zone
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
