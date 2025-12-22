# Real-Time Task System - Frontend Integration Guide

## Overview

The frontend real-time task system provides robust, live updates for task status, robot positions, and shelf locations through WebSocket connections. The system is designed with comprehensive error handling, automatic recovery, and data validation.

## Architecture

### Components

#### 1. **Task WebSocket Manager** (`src/services/taskWebsocket.ts`)
Manages WebSocket connections for task real-time updates.

**Features:**
- Automatic reconnection with exponential backoff
- Task subscription/unsubscription
- Map update subscriptions
- Event callback registry
- Connection state tracking

**Usage:**
```typescript
import { connectTaskWebSocket, subscribeToTask, onTaskWebSocketEvent } from './services/taskWebsocket';

// Connect
const socket = connectTaskWebSocket();

// Subscribe to task updates
subscribeToTask('task_123');

// Listen for events
onTaskWebSocketEvent('robot_position_update', (data) => {
  console.log('Robot moved to:', data.robot);
});
```

#### 2. **Real-Time Tasks Hook** (`src/hooks/useRealTimeTasks.ts`)
React hook for managing real-time task state.

**Features:**
- Automatic state management with reducer pattern
- Task subscription management
- Map view subscriptions
- On-demand data fetching
- Connection status tracking

**Usage:**
```typescript
import { useRealTimeTasks, useMapView } from '../hooks/useRealTimeTasks';

function MyComponent() {
  const {
    tasks,
    taskList,
    activeTasks,
    wsConnected,
    subscribeToTask,
    getTask,
  } = useRealTimeTasks();

  useEffect(() => {
    subscribeToTask('task_123');
  }, []);

  return <div>Tasks: {taskList.length}</div>;
}
```

#### 3. **Task Realtime API Service** (`src/services/taskRealtime.ts`)
REST API service for task real-time operations.

**Methods:**
- `updateRobotPosition(taskId, payload)` - Update robot position
- `updateTaskStatus(taskId, payload)` - Update task status
- `getTaskForMap(taskId)` - Get task data for map
- `getAllTasksForMap()` - Get all active tasks
- `getRobotTasksForMap(robotId)` - Get robot's tasks
- `broadcastMapUpdate()` - Broadcast map update to all clients

**Usage:**
```typescript
import { taskRealtimeService } from '../services/taskRealtime';

// Update robot position
await taskRealtimeService.updateRobotPosition('task_123', {
  robot_x: 10.5,
  robot_y: 20.3,
  status: 'MOVING_TO_SHELF'
});

// Update task status
await taskRealtimeService.updateTaskStatus('task_123', {
  old_status: 'MOVING_TO_SHELF',
  new_status: 'PICKING',
  current_target: 'SHELF'
});
```

#### 4. **Enhanced Map Component** (`src/components/EnhancedMap.tsx`)
Full-featured warehouse map with real-time task visualization.

**Features:**
- Live robot and shelf positions
- Task visualization with connection lines
- Zoom and pan controls
- Display toggles for grid, shelves, robots, tasks
- Real-time WebSocket updates
- Auto-refresh capabilities
- Error handling and recovery

**Usage:**
```typescript
import { EnhancedMap } from '../components/EnhancedMap';

function MapPage() {
  return <EnhancedMap />;
}
```

#### 5. **Real-Time Task Dashboard** (`src/components/RealTimeTaskDashboard.tsx`)
Dashboard component for monitoring active tasks.

**Features:**
- Live task status updates
- Robot position tracking
- Connection status indicator
- Compact and full-screen modes
- Task filtering and sorting
- Summary statistics

**Usage:**
```typescript
import { RealTimeTaskDashboard } from '../components/RealTimeTaskDashboard';

function Dashboard() {
  return (
    <RealTimeTaskDashboard
      compact={false}
      maxTasks={10}
    />
  );
}
```

#### 6. **Error Handling & Recovery** (`src/utils/errorHandling.ts`)
Comprehensive error handling and recovery system.

**Features:**
- Error classification (CONNECTION, TIMEOUT, NETWORK, SERVER, etc.)
- Error history tracking
- Recovery strategies
- Retry with exponential backoff
- Validation utilities
- Global error subscription

**Usage:**
```typescript
import { errorHandler, recoveryHandler, ValidationUtils } from '../utils/errorHandling';

// Handle errors
errorHandler.handle(new Error('Something failed'), 'CONNECTION_ERROR');

// Subscribe to errors
errorHandler.subscribe((error) => {
  console.log('Error occurred:', error.message);
});

// Retry with backoff
await recoveryHandler.retryWithBackoff(
  () => someAsyncOperation(),
  3,           // max attempts
  1000,        // initial delay
  10000        // max delay
);

// Validate data
if (ValidationUtils.validateTaskMapData(data)) {
  // Data is valid
}
```

#### 7. **Realtime Integration** (`src/services/realtimeIntegration.ts`)
Initialization module for the entire real-time system.

**Features:**
- System initialization
- Global error handling setup
- Recovery procedure setup
- Connection management
- Network state monitoring

**Usage:**
```typescript
import { realtimeIntegration } from '../services/realtimeIntegration';

// Initialize once at app startup
await realtimeIntegration.initialize();

// Check if ready
if (realtimeIntegration.isReady()) {
  // Real-time features available
}
```

## WebSocket Events

### Server-Emitted Events

#### Connection Events
- `connection_response` - Server acknowledges connection
- `subscribed` - Subscription confirmed
- `unsubscribed` - Unsubscription confirmed
- `map_subscribed` - Map updates subscription confirmed

#### Task Events
- `robot_position_update` - Robot moved (task-specific)
  ```json
  {
    "task_id": "string",
    "robot": { "x": number, "y": number },
    "status": "string",
    "timestamp": "ISO8601"
  }
  ```

- `task_status_change` - Task status changed
  ```json
  {
    "task_id": "string",
    "old_status": "string",
    "new_status": "string",
    "current_target": "string",
    "robot": { "x": number, "y": number },
    "shelf": { "id": "string", "x": number, "y": number },
    "drop_zone": { "id": "string", "x": number, "y": number },
    "timestamp": "ISO8601"
  }
  ```

- `shelf_location_fixed` - Shelf location is fixed during task
  ```json
  {
    "task_id": "string",
    "shelf_id": "string",
    "x": number,
    "y": number,
    "note": "string",
    "timestamp": "ISO8601"
  }
  ```

- `all_tasks_map_update` - All active tasks updated
  ```json
  {
    "tasks": [TaskMapData[]],
    "timestamp": "ISO8601"
  }
  ```

### Client-Emitted Events

- `subscribe_task` - Subscribe to task updates
  ```json
  { "task_id": "string" }
  ```

- `unsubscribe_task` - Unsubscribe from task updates
  ```json
  { "task_id": "string" }
  ```

- `subscribe_map` - Subscribe to map updates
- `request_task_data` - Request task data
  ```json
  { "task_id": "string" }
  ```

- `request_map_data` - Request all tasks data

## Data Structures

### TaskMapData
```typescript
interface TaskMapData {
  task_id: string;
  robot_id?: string;
  status: string;
  type?: string;
  robot: { x: number; y: number };
  shelf: {
    id: string;
    x: number;
    y: number;
    original?: boolean;
  };
  drop_zone?: {
    id: string;
    x: number;
    y: number;
    original?: boolean;
  };
  phase?: string;
  current_target?: string;
  created_at?: string;
  started_at?: string;
  last_updated?: string;
}
```

### RobotPositionUpdate
```typescript
interface RobotPositionUpdate {
  task_id: string;
  robot: { x: number; y: number };
  status: string;
  timestamp: string;
}
```

### TaskStatusChange
```typescript
interface TaskStatusChange {
  task_id: string;
  old_status: string;
  new_status: string;
  current_target?: string;
  robot: { x: number; y: number };
  shelf?: { id: string; x: number; y: number };
  drop_zone?: { id: string; x: number; y: number };
  timestamp: string;
}
```

## Error Handling

### Error Types
- `CONNECTION_ERROR` - WebSocket connection issues
- `TIMEOUT_ERROR` - Operation timeout
- `INVALID_DATA_ERROR` - Invalid data received
- `SERVER_ERROR` - Server-side error
- `NETWORK_ERROR` - Network unavailable
- `UNKNOWN_ERROR` - Unknown error

### Recovery Strategies
Each error type has a default recovery strategy:
- Connection errors: Retry with exponential backoff (max 5 attempts)
- Timeouts: Retry with longer delays (max 3 attempts)
- Network errors: Wait for network recovery, then retry
- Server errors: Notify user, optional retry
- Invalid data: Do not retry, log and handle locally

### Example Error Handling
```typescript
import { errorHandler, ErrorType } from '../utils/errorHandling';

try {
  await someAsyncOperation();
} catch (error) {
  const appError = errorHandler.handle(error, ErrorType.CONNECTION);
  
  // Subscribe to see if recovery succeeds
  const unsubscribe = errorHandler.subscribe((recoveryAttempt) => {
    if (recoveryAttempt.type === ErrorType.CONNECTION) {
      console.log('Recovery in progress');
    }
  });
}
```

## Best Practices

### 1. **Always Clean Up Subscriptions**
```typescript
useEffect(() => {
  subscribeToTask(taskId);
  
  return () => {
    unsubscribeFromTask(taskId);
  };
}, [taskId]);
```

### 2. **Validate Incoming Data**
```typescript
import { ValidationUtils } from '../utils/errorHandling';

onTaskWebSocketEvent('robot_position_update', (data) => {
  if (ValidationUtils.validateRobotPositionUpdate(data)) {
    // Process valid data
  } else {
    console.error('Invalid data received');
  }
});
```

### 3. **Handle Connection States**
```typescript
const { wsConnected, wsError } = useRealTimeTasks();

if (!wsConnected) {
  return <div>Waiting for connection...</div>;
}

if (wsError) {
  return <div>Error: {wsError}</div>;
}
```

### 4. **Use Compact Mode for Small Screens**
```typescript
<RealTimeTaskDashboard
  compact={window.innerWidth < 768}
  maxTasks={5}
/>
```

### 5. **Monitor Error History**
```typescript
import { errorHandler } from '../utils/errorHandling';

// Get recent errors
const recentErrors = errorHandler.getRecentErrors(5);
console.log('Recent errors:', recentErrors);

// Clear if needed
errorHandler.clearErrorHistory();
```

## Configuration

### Environment Variables
```env
VITE_WS_URL=ws://localhost:5000        # WebSocket URL
VITE_API_URL=http://localhost:5000/api # API Base URL
```

### Default Timeouts
- WebSocket connection timeout: 10 seconds
- Request timeout: 20 seconds
- Reconnection delays: 500ms - 5000ms (exponential backoff)

## Performance Considerations

1. **Message Throttling**: Real-time updates are emitted frequently. Consider debouncing/throttling in the UI layer if needed.

2. **Memory Management**: The error history is limited to 100 entries. Older entries are automatically removed.

3. **Canvas Rendering**: The map component uses requestAnimationFrame for smooth rendering.

4. **Callback Performance**: Ensure event callbacks are fast to avoid blocking other updates.

5. **Subscription Cleanup**: Always unsubscribe when components unmount to prevent memory leaks.

## Troubleshooting

### WebSocket Connection Issues
1. Check that the backend is running on the correct port (default: 5000)
2. Verify `VITE_WS_URL` is set correctly in environment
3. Check browser console for connection errors
4. Ensure JWT token is valid (stored in localStorage)

### Missing Real-Time Updates
1. Verify task subscription: `subscribeToTask(taskId)`
2. Check WebSocket connection status: `wsConnected`
3. Validate incoming data matches expected structure
4. Check browser network tab for WebSocket messages

### Memory Leaks
1. Always clean up subscriptions in useEffect cleanup
2. Unsubscribe from error handlers when done
3. Clear callbacks when components unmount
4. Monitor error history size

## File Structure
```
src/
├── services/
│   ├── taskWebsocket.ts          # WebSocket manager
│   ├── taskRealtime.ts           # REST API service
│   └── realtimeIntegration.ts    # System initialization
├── hooks/
│   └── useRealTimeTasks.ts       # React hooks
├── components/
│   ├── RealTimeTaskDashboard.tsx # Task dashboard
│   └── EnhancedMap.tsx           # Map component
└── utils/
    └── errorHandling.ts          # Error & recovery
```

## Testing

### Unit Testing Example
```typescript
import { ValidationUtils } from '../utils/errorHandling';

describe('ValidationUtils', () => {
  it('should validate correct task map data', () => {
    const validData = {
      task_id: 'task_123',
      status: 'PICKING',
      robot: { x: 10, y: 20 },
      shelf: { x: 5, y: 15 },
    };
    expect(ValidationUtils.validateTaskMapData(validData)).toBe(true);
  });
});
```

## Support & Debugging

Enable debug logging by setting a window variable:
```javascript
window.DEBUG_REALTIME = true;
```

This will log all WebSocket events and state changes to the console.

## Version History

- **v1.0.0** - Initial release with core real-time task features
  - WebSocket manager
  - React hooks for state management
  - Error handling and recovery
  - Map visualization
  - Task dashboard

## License

This module is part of the Warebot Frontend system.
