// =========================================================
// WAREHOUSE MANAGEMENT SYSTEM - TYPE DEFINITIONS
// Matches backend Python Pydantic models exactly
// =========================================================

// =========================================================
// ROBOT TYPES
// =========================================================

export type RobotStatus = 'IDLE' | 'BUSY' | 'ERROR' | 'OFFLINE';

/**
 * Robot entity
 * Backend stores position as current_x/current_y/current_yaw
 * Frontend displays as x/y/yaw for compatibility
 * Both fields are provided for flexibility
 */
export interface Robot {
  id: string;
  name: string;
  robot_id: string;
  available: boolean;
  status: RobotStatus;
  current_shelf_id?: string;
  
  // Position data - stored in backend as current_*
  current_x?: number;
  current_y?: number;
  current_yaw?: number;
  
  // Position data - alias for map visualization (x/y/yaw)
  x?: number;
  y?: number;
  yaw?: number;
  
  // Telemetry data
  cpu_usage?: number;
  ram_usage?: number;
  battery_level?: number;
  temperature?: number;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
}

/**
 * Robot creation payload
 * Matches RobotCreate Pydantic model
 */
export interface RobotCreate {
  name: string;
  robot_id: string;
  available?: boolean;
  status?: RobotStatus;
  current_shelf_id?: string;
  current_x?: number;
  current_y?: number;
  current_yaw?: number;
}

/**
 * Robot update payload
 * Matches RobotUpdate Pydantic model
 */
export interface RobotUpdate {
  name?: string;
  robot_id?: string;
  available?: boolean;
  status?: RobotStatus;
  current_shelf_id?: string;
  current_x?: number;
  current_y?: number;
  current_yaw?: number;
}

/**
 * Robot Telemetry (for InfluxDB time-series data)
 * Matches RobotTelemetry Pydantic model
 * NOTE: Telemetry uses x/y/yaw (not current_*)
 */
export interface RobotTelemetry {
  cpu_usage: number; // 0-100
  ram_usage: number; // 0-100
  battery_level: number; // 0-100
  temperature: number; // -40 to 120
  x: number;
  y: number;
  yaw?: number; // Robot orientation in radians
  status?: RobotStatus;
  timestamp?: string;
}

// =========================================================
// SHELF TYPES
// =========================================================

export type ShelfStatus = 'IDLE' | 'BUSY' | 'ERROR' | 'OFFLINE';

/**
 * Shelf location status enum
 * Tracks where the shelf is in its lifecycle
 */
export type ShelfLocationStatus = 
  | 'STORED'                    // At storage/home position
  | 'IN_TRANSIT'                // Being moved by robot
  | 'AT_DROP_ZONE'              // Arrived at drop zone
  | 'DELIVERED_AT_DROP_ZONE'    // Released at drop zone
  | 'REPOSITIONED'              // Repositioned to new location
  | 'REPOSITIONED_AT_ZONE';     // Repositioned at specific zone

/**
 * Shelf entity
 * CRITICAL DUAL LOCATION TRACKING:
 * - current_x/y/yaw: Live position (changes during tasks)
 * - storage_x/y/yaw: Home position (IMMUTABLE - never changes)
 * Matches ShelfCreate/ShelfUpdate Pydantic models
 */
export interface Shelf {
  id: string;
  warehouse_id: string;
  level: number;
  
  // -------------------------
  // CURRENT LOCATION (LIVE)
  // -------------------------
  // This is where the shelf IS RIGHT NOW
  current_x?: number;
  current_y?: number;
  current_yaw?: number;
  
  // -------------------------
  // ALIAS FOR COMPATIBILITY
  // -------------------------
  // Some components use x/y/yaw instead of current_*
  x?: number;
  y?: number;
  yaw?: number;
  
  // -------------------------
  // STORAGE LOCATION (IMMUTABLE)
  // -------------------------
  // This is the shelf's HOME position
  // NEVER changes during task execution
  // Only admin can modify via setStorageLocation API
  storage_x: number;
  storage_y: number;
  storage_yaw?: number;
  
  // -------------------------
  // LOCATION STATUS
  // -------------------------
  location_status?: ShelfLocationStatus;
  last_task_id?: string;
  
  // -------------------------
  // STATE
  // -------------------------
  available: boolean;
  status: ShelfStatus;
  
  // -------------------------
  // APRILTAG
  // -------------------------
  april_tag_url?: string;
  april_tag_id?: number;
  
  // -------------------------
  // RELATIONSHIPS
  // -------------------------
  products?: Product[];
  
  // -------------------------
  // METADATA
  // -------------------------
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Shelf creation payload
 * Matches ShelfCreate Pydantic model
 */
export interface ShelfCreate {
  warehouse_id: string;
  
  // Current location (required)
  current_x: number;
  current_y: number;
  current_yaw?: number;
  
  level: number;
  
  // Storage location (optional - backend copies from current if not provided)
  storage_x?: number;
  storage_y?: number;
  storage_yaw?: number;
  
  available?: boolean;
  status?: ShelfStatus;
  april_tag_url?: string;
}

/**
 * Shelf update payload
 * Matches ShelfUpdate Pydantic model
 */
export interface ShelfUpdate {
  warehouse_id?: string;
  
  // Current location (live position updates)
  current_x?: number;
  current_y?: number;
  current_yaw?: number;
  
  level?: number;
  
  // Storage location (RARE - admin only)
  storage_x?: number;
  storage_y?: number;
  storage_yaw?: number;
  
  available?: boolean;
  status?: ShelfStatus;
  location_status?: 'AT_STORAGE' | 'AT_ZONE' | 'IN_TRANSIT';
  april_tag_url?: string;
}

/**
 * Update current location payload
 * Used by robots to report real-time position
 */
export interface UpdateLocationInput {
  current_x: number;
  current_y: number;
  current_yaw?: number;
}

/**
 * Set storage location payload
 * Admin-only operation to change home position
 */
export interface SetStorageLocationInput {
  storage_x: number;
  storage_y: number;
  storage_yaw?: number;
}

/**
 * Shelf location info response
 * Returns both current and storage locations
 */
export interface ShelfLocationInfo {
  shelf_id: string;
  current_x: number;
  current_y: number;
  current_yaw?: number;
  storage_x: number;
  storage_y: number;
  storage_yaw?: number;
  location_status?: 'AT_STORAGE' | 'AT_ZONE' | 'IN_TRANSIT';
  updated_at?: string;
}

/**
 * Location history entry
 * Historical position tracking
 */
export interface LocationHistoryEntry {
  timestamp: string;
  x: number;
  y: number;
  yaw?: number;
  status?: string;
}

// =========================================================
// PRODUCT TYPES
// =========================================================

/**
 * Product entity
 * Matches ProductCreate/ProductUpdate Pydantic models
 */
export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  
  // Optional fields
  category?: string;
  brand?: string;
  price?: number;
  weight_kg?: number;
  dimensions_cm?: {
    length?: number;
    width?: number;
    height?: number;
  };
  barcode?: string;
  
  // Images
  main_image_url?: string;
  image_urls?: string[];
  
  // Relationships
  shelf_id?: string;
  description?: string;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
}

/**
 * Product creation payload
 * Matches ProductCreate Pydantic model
 */
export interface ProductCreate {
  name: string;
  sku: string;
  quantity: number;
  
  category?: string;
  brand?: string;
  price?: number;
  weight_kg?: number;
  dimensions_cm?: {
    length?: number;
    width?: number;
    height?: number;
  };
  barcode?: string;
  
  main_image_url?: string;
  image_urls?: string[];
  shelf_id?: string;
  description?: string;
}

/**
 * Product update payload
 * Matches ProductUpdate Pydantic model
 */
export interface ProductUpdate {
  name?: string;
  sku?: string;
  quantity?: number;
  
  category?: string;
  brand?: string;
  price?: number;
  weight_kg?: number;
  dimensions_cm?: {
    length?: number;
    width?: number;
    height?: number;
  };
  barcode?: string;
  
  main_image_url?: string;
  image_urls?: string[];
  shelf_id?: string;
  description?: string;
}

// =========================================================
// TASK TYPES
// =========================================================

/**
 * Task type enum
 * Matches TaskCreate Pydantic model task_type field
 */
export type TaskType = 
  | 'PICKUP_AND_DELIVER'  // Pick shelf from current location, deliver to zone
  | 'MOVE_SHELF'          // Move shelf to a new target location
  | 'RETURN_SHELF'        // Return shelf from zone back to storage
  | 'REPOSITION';         // Reposition shelf within warehouse

/**
 * Task status enum
 * Matches TaskStatusEnum in Pydantic models
 * Complete state machine for task lifecycle
 */
export type TaskStatus = 
  | 'PENDING'               // Task created, waiting for robot assignment
  | 'ASSIGNED'              // Robot assigned to task
  | 'MOVING_TO_PICKUP'      // Robot moving to shelf pickup location
  | 'ARRIVED_AT_PICKUP'     // Robot arrived at pickup location
  | 'ATTACHED'              // Robot attached to shelf
  | 'MOVING_TO_DROP'        // Robot moving shelf to drop location
  | 'ARRIVED_AT_DROP'       // Robot arrived at drop location
  | 'RELEASED'              // Robot released shelf at drop location
  | 'MOVING_TO_REFERENCE'   // Robot returning to reference position
  | 'COMPLETED'             // Task successfully completed
  | 'ERROR'                 // Task failed with error
  | 'CANCELLED';            // Task was cancelled

/**
 * Task completion action enum
 * Indicates what happened when task completed
 */
export type TaskCompletionAction = 
  | 'RESTORED_TO_STORAGE'     // Shelf returned to storage location
  | 'DELIVERED_TO_DROP_ZONE'  // Shelf delivered to drop zone
  | 'MOVED_TO_TARGET'         // Shelf moved to target location
  | 'REPOSITIONED_AT_ZONE';   // Shelf repositioned at zone

/**
 * Task entity
 * Comprehensive task tracking with positions, status, and metadata
 */
export interface Task {
  id: string;
  shelf_id: string;
  assigned_robot_id?: string;
  assigned_robot_name?: string;
  robot_id?: string;
  priority: number;
  
  status: TaskStatus;
  task_type: TaskType;
  
  description?: string;
  zone_id?: string;
  drop_zone_id?: string;
  target_shelf_id?: string;
  target_zone_id?: string;
  
  // -------------------------
  // PICKUP LOCATION
  // -------------------------
  // Shelf current location at task assignment time
  pickup_x?: number;
  pickup_y?: number;
  pickup_yaw?: number;
  
  // -------------------------
  // DROP LOCATION
  // -------------------------
  // Zone or target location coordinates
  drop_x?: number;
  drop_y?: number;
  drop_yaw?: number;
  
  // -------------------------
  // LEGACY TARGET COORDS
  // -------------------------
  // For backward compatibility
  target_x?: number;
  target_y?: number;
  target_yaw?: number;
  
  // -------------------------
  // ORIGIN SNAPSHOTS
  // -------------------------
  // Immutable at task creation - shelf's original positions
  origin_storage_x?: number;
  origin_storage_y?: number;
  origin_storage_yaw?: number;
  origin_pickup_x?: number;
  origin_pickup_y?: number;
  origin_pickup_yaw?: number;
  
  // -------------------------
  // CURRENT ROBOT POSITION
  // -------------------------
  // Robot's live position during task execution
  current_robot_x?: number;
  current_robot_y?: number;
  current_yaw?: number;
  
  // -------------------------
  // COMPLETION METADATA
  // -------------------------
  completion_action?: TaskCompletionAction;
  duration_seconds?: number;
  
  // -------------------------
  // PROGRESS
  // -------------------------
  progress?: number;
  error_message?: string;
  
  // -------------------------
  // TIMESTAMPS
  // -------------------------
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Task creation payload
 * Matches TaskCreate Pydantic model
 */
export interface TaskCreate {
  shelf_id: string;
  priority?: number;
  description?: string;
  zone_id?: string;
  drop_zone_id?: string;
  task_type?: TaskType;
  target_shelf_id?: string;
  target_zone_id?: string;
  
  // Origin snapshots (populated by backend at creation time)
  origin_storage_x?: number;
  origin_storage_y?: number;
  origin_storage_yaw?: number;
  origin_pickup_x?: number;
  origin_pickup_y?: number;
  origin_pickup_yaw?: number;
}

// =========================================================
// ZONE TYPES
// =========================================================

/**
 * Zone entity
 * Matches ZoneCreate/ZoneUpdate Pydantic models
 */
export interface Zone {
  id: string;
  zone_id: string;
  name?: string;
  x: number;
  y: number;
  yaw?: number;
  
  // Metadata
  deleted?: boolean;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Zone creation payload
 * Matches ZoneCreate Pydantic model
 */
export interface ZoneCreate {
  zone_id: string;
  name?: string;
  x: number;
  y: number;
  yaw?: number;
}

/**
 * Zone update payload
 * Matches ZoneUpdate Pydantic model
 */
export interface ZoneUpdate {
  name?: string;
  x?: number;
  y?: number;
  yaw?: number;
}

/**
 * Zone statistics response
 * Aggregated zone usage data
 */
export interface ZoneStats {
  total_zones: number;
  zones: Array<{
    zone_id: string;
    name?: string;
    x: number;
    y: number;
    tasks_as_drop_location: number;
  }>;
  timestamp?: string;
}

// =========================================================
// STOCK/PRODUCT TRANSACTION TYPES
// =========================================================

/**
 * Transaction action enum
 * Matches ProductTransactionCreate Pydantic model action field
 */
export type TransactionAction = 'PICK' | 'RETURN' | 'ADJUST';

/**
 * Product transaction entity
 * Inventory movement tracking
 */
export interface ProductTransaction {
  id: string;
  product_id: string;
  quantity: number;
  action: TransactionAction;
  description?: string;
  
  created_at?: string;
  updated_at?: string;
}

/**
 * Product transaction creation payload
 * Matches ProductTransactionCreate Pydantic model
 */
export interface ProductTransactionCreate {
  product_id: string;
  quantity: number;
  action: TransactionAction;
  description?: string;
}

/**
 * Stock return payload
 * Matches StockReturn Pydantic model
 */
export interface StockReturn {
  product_id: string;
  quantity: number;
  description?: string;
}

/**
 * Stock adjustment payload
 * Matches StockAdjust Pydantic model
 */
export interface StockAdjust {
  product_id: string;
  new_quantity: number;
  reason?: string;
}

// =========================================================
// IMAGE TYPES
// =========================================================

/**
 * Set main image payload
 * Matches SetMainImage Pydantic model
 */
export interface SetMainImage {
  image_url: string;
}

/**
 * Delete image payload
 * Matches DeleteImage Pydantic model
 */
export interface DeleteImage {
  index: number;
}

// =========================================================
// AUTH TYPES
// =========================================================

/**
 * Admin creation payload
 * Matches AdminCreate Pydantic model
 */
export interface AdminCreate {
  username: string;
  password: string;
}

/**
 * Admin login payload
 * Matches AdminLogin Pydantic model
 */
export interface AdminLogin {
  username: string;
  password: string;
}

/**
 * User entity
 * Authenticated user information
 */
export interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  created_at?: string;
  updated_at?: string;
}

/**
 * Auth state
 * Frontend authentication state
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

/**
 * Auth response
 * JWT authentication response
 */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

// =========================================================
// API RESPONSE TYPES
// =========================================================

/**
 * Generic API response wrapper
 * Standard response format for all API endpoints
 */
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: Array<{
    loc?: string[];
    msg?: string;
    type?: string;
  }>;
  message?: string;
}

/**
 * Paginated response wrapper
 * For list endpoints with pagination
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// =========================================================
// DASHBOARD TYPES
// =========================================================

/**
 * Dashboard statistics
 * System-wide metrics and health status
 */
export interface DashboardStats {
  totalRobots: number;
  activeRobots: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  activeTasks: number;
  totalShelves: number;
  totalProducts: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

// =========================================================
// MAP VISUALIZATION TYPES
// =========================================================

/**
 * Map origin
 * Can be object or array format
 */
export interface MapOrigin {
  x: number;
  y: number;
  yaw?: number;
}

/**
 * Map data structure
 * Complete warehouse map with all entities
 */
export interface MapData {
  width: number;
  height: number;
  resolution: number;
  origin: MapOrigin | [number, number, number?];
  occupancy_grid?: number[][];
  robots: Robot[];
  shelves: Shelf[];
  tasks: Task[];
  zones?: Zone[];
}

// =========================================================
// WEBSOCKET EVENT TYPES
// =========================================================

/**
 * Robot position update event
 * Real-time robot movement
 */
export interface RobotPositionUpdate {
  robot_id: string;
  x: number;
  y: number;
  yaw?: number;
  timestamp?: number;
}

/**
 * Shelf location update event
 * Real-time shelf movement
 */
export interface ShelfLocationUpdate {
  shelf_id: string;
  current_x: number;
  current_y: number;
  current_yaw?: number;
  storage_x?: number;
  storage_y?: number;
  storage_yaw?: number;
  location_status?: ShelfLocationStatus;
  task_id?: string;
  timestamp?: string;
}

/**
 * Task status update event
 * Real-time task progress
 */
export interface TaskStatusUpdate {
  task_id: string;
  robot_id?: string;
  task_state?: string;
  status: TaskStatus;
  timestamp?: number;
}

/**
 * Task progress update event
 * Detailed task execution progress
 */
export interface TaskProgressUpdate {
  task_id: string;
  robot_id?: string;
  task_state?: string;
  status: TaskStatus;
  current_robot_x?: number;
  current_robot_y?: number;
  timestamp?: number;
}

/**
 * Map update event
 * Complete map refresh
 */
export interface MapUpdateEvent {
  width?: number;
  height?: number;
  resolution?: number;
  origin?: MapOrigin;
  robots?: Robot[];
  shelves?: Shelf[];
  tasks?: Task[];
  zones?: Zone[];
  timestamp?: string;
}

// =========================================================
// LIVE STATISTICS TYPES
// =========================================================

/**
 * Live task statistics
 * Real-time task metrics
 */
export interface LiveTaskStats {
  tasks: {
    total: number;
    assigned: number;
    in_progress: number;
    completed: number;
    failed: number;
    average_duration_seconds: number;
  };
  robots: {
    total: number;
    available: number;
    busy: number;
    offline: number;
  };
  timestamp: string;
}

/**
 * Live robot statistics
 * Real-time robot metrics
 */
export interface LiveRobotStats {
  total: number;
  available: number;
  busy: number;
  offline: number;
  error: number;
  battery_levels: {
    robot_id: string;
    battery_level: number;
  }[];
  timestamp: string;
}

/**
 * Live system health
 * Overall system status
 */
export interface LiveSystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime_seconds: number;
  active_connections: number;
  mqtt_connected: boolean;
  influxdb_connected: boolean;
  mongodb_connected: boolean;
  timestamp: string;
}

// =========================================================
// ERROR TYPES
// =========================================================

/**
 * API error
 * Standardized error format
 */
export interface ApiError {
  error: string;
  message?: string;
  details?: Array<{
    loc?: string[];
    msg?: string;
    type?: string;
  }>;
  status?: number;
}

/**
 * Validation error detail
 * Pydantic validation error format
 */
export interface ValidationErrorDetail {
  loc: string[];
  msg: string;
  type: string;
}

// =========================================================
// UTILITY TYPES
// =========================================================

/**
 * Coordinates
 * Generic 2D/3D position
 */
export interface Coordinates {
  x: number;
  y: number;
  yaw?: number;
}

/**
 * Timestamp range
 * For filtering by time
 */
export interface TimestampRange {
  start?: string;
  end?: string;
}

/**
 * Sort options
 * For list queries
 */
export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Filter options
 * For list queries
 */
export interface FilterOptions {
  status?: string[];
  search?: string;
  dateRange?: TimestampRange;
}

/**
 * List query parameters
 * Standard list endpoint params
 */
export interface ListQueryParams {
  limit?: number;
  offset?: number;
  sort?: SortOptions;
  filter?: FilterOptions;
}

// =========================================================
// TYPE GUARDS
// =========================================================

/**
 * Type guard for Robot
 */
export function isRobot(obj: any): obj is Robot {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.robot_id === 'string' &&
    typeof obj.name === 'string'
  );
}

/**
 * Type guard for Shelf
 */
export function isShelf(obj: any): obj is Shelf {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.warehouse_id === 'string' &&
    typeof obj.storage_x === 'number' &&
    typeof obj.storage_y === 'number'
  );
}

/**
 * Type guard for Task
 */
export function isTask(obj: any): obj is Task {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.shelf_id === 'string' &&
    typeof obj.priority === 'number'
  );
}

/**
 * Type guard for Zone
 */
export function isZone(obj: any): obj is Zone {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.zone_id === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number'
  );
}

// =========================================================
// HELPER TYPES
// =========================================================

/**
 * Make all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/**
 * Make all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Extract properties that are not undefined
 */
export type NonUndefined<T> = T extends undefined ? never : T;

/**
 * Extract array element type
 */
export type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;