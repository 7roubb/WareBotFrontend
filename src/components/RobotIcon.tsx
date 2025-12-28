/**
 * Robot icon/marker component for the map
 * Shows robot status with visual indicators and trail
 */
import React from 'react';
import { Robot } from '../types/map';

interface RobotIconProps {
  robot: Robot;
  isSelected?: boolean;
  onClick?: () => void;
}

export function RobotIcon({ robot, isSelected, onClick }: RobotIconProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'IDLE':
        return '#22c55e'; // Green
      case 'CHARGING':
        return '#f97316'; // Orange
      case 'BUSY':
        return '#eab308'; // Yellow
      case 'OFFLINE':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Slate
    }
  };

  const getStatusLabel = (status?: string) => {
    return status || 'UNKNOWN';
  };

  const statusColor = getStatusColor(robot.status);

  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
        isSelected
          ? 'bg-slate-700 border-amber-400'
          : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
      }`}
    >
      {/* Status indicator */}
      <div
        className="w-3 h-3 rounded-full animate-pulse"
        style={{ backgroundColor: statusColor }}
      />

      {/* Robot ID */}
      <span className="text-sm font-semibold text-slate-200">{robot.id}</span>

      {/* Status badge */}
      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: statusColor, color: '#000' }}>
        {getStatusLabel(robot.status)}
      </span>

      {/* Battery indicator */}
      {robot.battery !== undefined && (
        <span className="text-xs text-slate-400">
          🔋 {Math.round(robot.battery)}%
        </span>
      )}

      {/* Position info */}
      <span className="text-xs text-slate-500 font-mono">
        ({robot.x.toFixed(1)}, {robot.y.toFixed(1)})
      </span>
    </div>
  );
}
