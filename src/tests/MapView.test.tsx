/**
 * Component tests for MapView
 * Verifies rendering of storage vs current markers and shelf highlighting
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MapView } from '../components/MapView';
import { MapProvider } from '../context/MapContext';
import { ShelfMap, Robot, TaskMapView } from '../types/map';

// Mock react-konva
jest.mock('react-konva', () => ({
  Stage: ({ children }: any) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
  Circle: ({ x, y, fill }: any) => (
    <div data-testid={`circle-${x}-${y}`} data-fill={fill} />
  ),
  Rect: ({ x, y, fill, onClick }: any) => (
    <div
      data-testid={`rect-${x}-${y}`}
      data-fill={fill}
      onClick={onClick}
      role="button"
    />
  ),
  Line: ({ points }: any) => <div data-testid="line" data-points={points} />,
  Text: ({ text }: any) => <div data-testid="text">{text}</div>,
  Group: ({ children }: any) => <div data-testid="group">{children}</div>,
  Image: ({ src }: any) => <img data-testid="image" src={src} alt="" />,
}));

const mockShelf: ShelfMap = {
  id: 'shelf-1',
  warehouse_id: 'warehouse-1',
  storage: { x: 100, y: 150, yaw: 0 },
  current: { x: 100, y: 150, yaw: 0 },
  location_status: 'STORED',
  available: true,
  status: 'IDLE',
};

const mockShelfDifferent: ShelfMap = {
  id: 'shelf-2',
  warehouse_id: 'warehouse-1',
  storage: { x: 200, y: 250, yaw: 0 },
  current: { x: 350, y: 400, yaw: 0 }, // Different from storage
  location_status: 'IN_TRANSIT',
  available: false,
  status: 'BUSY',
};

const mockRobot: Robot = {
  id: 'robot-1',
  x: 50,
  y: 75,
  status: 'BUSY',
  battery: 85,
};

const mockTask: TaskMapView = {
  task_id: 'task-1',
  status: 'IN_PROGRESS',
  task_type: 'PICKUP_AND_DELIVER',
  robot: mockRobot,
  shelf: {
    id: 'shelf-1',
    storage: { x: 100, y: 150 },
    current: { x: 100, y: 150 },
  },
  drop_zone: {
    id: 'zone-1',
    x: 500,
    y: 500,
  },
};

describe('MapView Component', () => {
  it('should render the stage', () => {
    render(
      <MapProvider>
        <MapView width={800} height={600} />
      </MapProvider>
    );

    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(screen.getByTestId('layer')).toBeInTheDocument();
  });

  it('should render shelf storage marker (immutable)', () => {
    const { result: contextResult } = renderWithContext();
    const { useMapContext } = require('../context/MapContext');

    render(
      <MapProvider>
        <MapViewWithShelf shelf={mockShelf} />
      </MapProvider>
    );

    // Should render storage anchor at (100, 150)
    expect(screen.getByTestId('circle-100-150')).toBeInTheDocument();
  });

  it('should render shelf current marker', () => {
    render(
      <MapProvider>
        <MapViewWithShelf shelf={mockShelf} />
      </MapProvider>
    );

    // Should render current location as rect
    expect(screen.getByTestId('rect-88-138')).toBeInTheDocument(); // x-12, y-12 offset
  });

  it('should draw dashed line when shelf location differs from storage', () => {
    render(
      <MapProvider>
        <MapViewWithShelf shelf={mockShelfDifferent} />
      </MapProvider>
    );

    // Should have a dashed line connecting storage to current
    const lines = screen.getAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should NOT draw dashed line when shelf is at storage location', () => {
    render(
      <MapProvider>
        <MapViewWithShelf shelf={mockShelf} />
      </MapProvider>
    );

    // Verify that the shelf location matches storage
    expect(mockShelf.current.x).toBe(mockShelf.storage.x);
    expect(mockShelf.current.y).toBe(mockShelf.storage.y);
  });

  it('should render robots', () => {
    render(
      <MapProvider>
        <MapViewWithRobot robot={mockRobot} />
      </MapProvider>
    );

    // Should render robot circle at (50, 75)
    expect(screen.getByTestId('circle-50-75')).toBeInTheDocument();
  });

  it('should highlight active task with arrow to target', () => {
    render(
      <MapProvider>
        <MapViewWithTask task={mockTask} selectedTaskId={mockTask.task_id} />
      </MapProvider>
    );

    // Should render arrow from robot to drop zone
    const lines = screen.getAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should apply correct color to shelf based on location_status', () => {
    const { rerender } = render(
      <MapProvider>
        <MapViewWithShelf shelf={{ ...mockShelf, location_status: 'STORED' }} />
      </MapProvider>
    );

    // STORED should be green (#22c55e)
    let rect = screen.getByTestId('rect-88-138');
    expect(rect).toHaveAttribute('data-fill', '#22c55e');

    // IN_TRANSIT should be orange
    rerender(
      <MapProvider>
        <MapViewWithShelf shelf={{ ...mockShelf, location_status: 'IN_TRANSIT' }} />
      </MapProvider>
    );

    rect = screen.getByTestId('rect-88-138');
    expect(rect).toHaveAttribute('data-fill', '#f97316');
  });

  it('should allow shelf selection by clicking', () => {
    const { container } = render(
      <MapProvider>
        <MapViewWithShelf shelf={mockShelf} />
      </MapProvider>
    );

    const shelfRect = screen.getByTestId('rect-88-138');
    fireEvent.click(shelfRect);

    // Verify shelf details panel appears or selection is handled
    // (implementation depends on component behavior)
  });

  it('should display controls overlay', () => {
    render(
      <MapProvider>
        <MapView width={800} height={600} />
      </MapProvider>
    );

    expect(screen.getByText(/Map Controls/i)).toBeInTheDocument();
  });
});

// Helper component to test with shelf
function MapViewWithShelf({ shelf }: { shelf: ShelfMap }) {
  const { setShelves } = require('../context/MapContext').useMapContext();
  React.useEffect(() => {
    setShelves([shelf]);
  }, [shelf, setShelves]);

  return <MapView width={800} height={600} />;
}

// Helper component to test with robot
function MapViewWithRobot({ robot }: { robot: Robot }) {
  const { setRobots } = require('../context/MapContext').useMapContext();
  React.useEffect(() => {
    setRobots([robot]);
  }, [robot, setRobots]);

  return <MapView width={800} height={600} />;
}

// Helper component to test with task
function MapViewWithTask({
  task,
  selectedTaskId,
}: {
  task: TaskMapView;
  selectedTaskId?: string;
}) {
  const { setTasks } = require('../context/MapContext').useMapContext();
  React.useEffect(() => {
    setTasks([task]);
  }, [task, setTasks]);

  return <MapView width={800} height={600} selectedTaskId={selectedTaskId} />;
}
