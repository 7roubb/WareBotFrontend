/**
 * Interactive map view component using react-konva
 * Renders shelves (with storage/current position distinction) and robots
 * Supports shelf selection and task highlighting
 */
import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Rect, Line, Text, Group, Image as KonvaImage } from 'react-konva';
import { useMapContext } from '../context/MapContext';
import { TaskMapView, ShelfMap, Robot } from '../types/map';
import { ShelfDetailsPanel } from './ShelfDetailsPanel';

interface MapViewProps {
  width?: number;
  height?: number;
  onTaskSelect?: (task: TaskMapView) => void;
  selectedTaskId?: string;
}

export function MapView({
  width = 1200,
  height = 800,
  onTaskSelect,
  selectedTaskId,
}: MapViewProps) {
  const { tasks, shelves, robots } = useMapContext();
  const stageRef = useRef<any>(null);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Handle zoom with mouse wheel
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setZoom(newScale);

    const newPos = {
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    };
    setPanX(newPos.x);
    setPanY(newPos.y);
  };

  // Handle panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: any) => {
    if (e.evt.button === 2) { // Right mouse button for panning
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX - panX, y: e.evt.clientY - panY });
    }
  };

  const handleMouseMove = (e: any) => {
    if (isPanning) {
      setPanX(e.evt.clientX - panStart.x);
      setPanY(e.evt.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Color mapping for shelf status
  const getShelfColor = (shelf: ShelfMap) => {
    switch (shelf.location_status) {
      case 'STORED':
        return '#22c55e'; // Green
      case 'IN_TRANSIT':
        return '#f97316'; // Orange
      case 'AT_DROP_ZONE':
      case 'DELIVERED_AT_DROP_ZONE':
        return '#ef4444'; // Red
      case 'RESTORED_TO_STORAGE':
        return '#3b82f6'; // Blue
      default:
        return '#64748b'; // Slate
    }
  };

  // Color mapping for robot status
  const getRobotColor = (robot: Robot) => {
    switch (robot.status) {
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

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={panX}
        y={panY}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <Layer>
          {/* Grid background */}
          {Array.from({ length: 20 }).map((_, i) => (
            <Line
              key={`h-${i}`}
              points={[0, i * 50, 2000, i * 50]}
              stroke="#334155"
              strokeWidth={1}
              opacity={0.3}
            />
          ))}
          {Array.from({ length: 40 }).map((_, i) => (
            <Line
              key={`v-${i}`}
              points={[i * 50, 0, i * 50, 1000]}
              stroke="#334155"
              strokeWidth={1}
              opacity={0.3}
            />
          ))}

          {/* Shelves */}
          {Array.from(shelves.values()).map((shelf) => {
            const isSelected = shelf.id === selectedShelfId;
            const isDifferent = 
              shelf.current.x !== shelf.storage.x || 
              shelf.current.y !== shelf.storage.y;

            return (
              <Group key={shelf.id}>
                {/* Storage anchor (immutable home position) */}
                <Circle
                  x={shelf.storage.x}
                  y={shelf.storage.y}
                  radius={8}
                  fill="#94a3b8"
                  stroke="#1e293b"
                  strokeWidth={2}
                  opacity={0.6}
                />

                {/* Current crate location (mutable) */}
                <Rect
                  x={shelf.current.x - 12}
                  y={shelf.current.y - 12}
                  width={24}
                  height={24}
                  fill={getShelfColor(shelf)}
                  stroke={isSelected ? '#fbbf24' : '#1e293b'}
                  strokeWidth={isSelected ? 3 : 2}
                  cornerRadius={4}
                  onClick={() => setSelectedShelfId(shelf.id)}
                  onTap={() => setSelectedShelfId(shelf.id)}
                  opacity={0.8}
                  listening={true}
                />

                {/* Dashed line connecting storage to current if different */}
                {isDifferent && (
                  <Line
                    points={[
                      shelf.storage.x,
                      shelf.storage.y,
                      shelf.current.x,
                      shelf.current.y,
                    ]}
                    stroke="#fbbf24"
                    strokeWidth={1}
                    dash={[4, 4]}
                    opacity={0.5}
                  />
                )}

                {/* Shelf ID label */}
                <Text
                  x={shelf.current.x + 15}
                  y={shelf.current.y - 10}
                  text={shelf.id.slice(-4)}
                  fontSize={12}
                  fill="#e2e8f0"
                  opacity={0.7}
                />

                {/* Storage label */}
                <Text
                  x={shelf.storage.x + 15}
                  y={shelf.storage.y - 10}
                  text="S"
                  fontSize={10}
                  fill="#94a3b8"
                  opacity={0.5}
                />
              </Group>
            );
          })}

          {/* Robots */}
          {Array.from(robots.values()).map((robot) => (
            <Group key={robot.id}>
              <Circle
                x={robot.x}
                y={robot.y}
                radius={10}
                fill={getRobotColor(robot)}
                stroke="#1e293b"
                strokeWidth={2}
                opacity={0.8}
              />
              <Text
                x={robot.x + 15}
                y={robot.y - 10}
                text={robot.id.slice(-4)}
                fontSize={11}
                fill="#e2e8f0"
                opacity={0.7}
              />
            </Group>
          ))}

          {/* Active task highlighting */}
          {selectedTaskId && tasks.has(selectedTaskId) && (() => {
            const task = tasks.get(selectedTaskId)!;
            return (
              <Group>
                {/* Arrow from robot to target */}
                {task.robot && (
                  <Line
                    points={[
                      task.robot.x,
                      task.robot.y,
                      task.drop_zone?.x || task.shelf.current.x,
                      task.drop_zone?.y || task.shelf.current.y,
                    ]}
                    stroke="#60a5fa"
                    strokeWidth={2}
                    opacity={0.6}
                  />
                )}
                {/* Highlight target */}
                <Circle
                  x={task.drop_zone?.x || task.shelf.current.x}
                  y={task.drop_zone?.y || task.shelf.current.y}
                  radius={15}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dash={[4, 4]}
                  opacity={0.7}
                />
              </Group>
            );
          })()}
        </Layer>
      </Stage>

      {/* Shelf details panel */}
      {selectedShelfId && shelves.has(selectedShelfId) && (
        <ShelfDetailsPanel
          shelf={shelves.get(selectedShelfId)!}
          onClose={() => setSelectedShelfId(null)}
        />
      )}

      {/* Map controls */}
      <div className="absolute top-4 left-4 bg-slate-800/90 p-4 rounded-lg text-slate-200 text-sm space-y-2">
        <p className="font-semibold">Map Controls</p>
        <p>🖱️ Scroll to zoom</p>
        <p>🖱️ Right-click to pan</p>
        <p>📍 Click shelf for details</p>
        <p className="mt-2 text-xs">
          <span className="inline-block w-3 h-3 bg-green-500 mr-2"></span>Stored
          <br />
          <span className="inline-block w-3 h-3 bg-orange-500 mr-2"></span>In Transit
          <br />
          <span className="inline-block w-3 h-3 bg-red-500 mr-2"></span>At Drop
          <br />
          <span className="inline-block w-3 h-3 bg-blue-500 mr-2"></span>Restored
        </p>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 px-3 py-2 rounded text-slate-200 text-sm">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}
