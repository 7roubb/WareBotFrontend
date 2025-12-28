import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';
import {
  Clock,
  Play,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface StatusBadgeProps {
  status: TaskStatus | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  PENDING: { label: 'Pending', icon: Clock, className: 'status-pending' },
  ASSIGNED: { label: 'Assigned', icon: Play, className: 'status-active' },
  MOVING_TO_SHELF: { label: 'Moving to Shelf', icon: Truck, className: 'bg-purple-500/20 text-purple-400' },
  PICKING: { label: 'Picking', icon: Package, className: 'bg-orange-500/20 text-orange-400' },
  MOVING_TO_DROP: { label: 'Moving to Drop', icon: Truck, className: 'bg-pink-500/20 text-pink-400' },
  DROPPING: { label: 'Dropping', icon: Package, className: 'bg-indigo-500/20 text-indigo-400' },
  RETURNING: { label: 'Returning', icon: Loader2, className: 'bg-cyan-500/20 text-cyan-400' },
  COMPLETED: { label: 'Completed', icon: CheckCircle, className: 'status-completed' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, className: 'status-offline' },
  FAILED: { label: 'Failed', icon: AlertTriangle, className: 'status-error' },
  // Robot statuses
  idle: { label: 'Idle', icon: Clock, className: 'status-pending' },
  busy: { label: 'Busy', icon: Loader2, className: 'status-active' },
  offline: { label: 'Offline', icon: XCircle, className: 'status-offline' },
  charging: { label: 'Charging', icon: Play, className: 'bg-yellow-500/20 text-yellow-400' },
  error: { label: 'Error', icon: AlertTriangle, className: 'status-error' },
  // Shelf statuses
  available: { label: 'Available', icon: CheckCircle, className: 'status-completed' },
  occupied: { label: 'Occupied', icon: Package, className: 'status-active' },
  maintenance: { label: 'Maintenance', icon: AlertTriangle, className: 'status-pending' },
};

export function StatusBadge({ status, size = 'md', showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, icon: Clock, className: 'status-offline' };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'status-badge',
        config.className,
        size === 'sm' && 'text-[10px] px-2 py-0.5',
        className
      )}
    >
      {showIcon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </span>
  );
}
