// Obstacle Detection System for Shelf Placement
// ============================================================================
// This system checks the occupancy grid to verify safe shelf placement
// ============================================================================

/**
 * Occupancy Grid Structure:
 * - data: array of values (0-100)
 *   - 0 = free/empty
 *   - 100 = occupied/obstacle
 *   - -1/50-99 = unknown
 * - width: grid width in cells
 * - height: grid height in cells
 * - resolution: meters per cell (e.g., 0.03m = 3cm per cell)
 * - origin: [x, y, z] world coordinates of grid origin
 */

interface OccupancyGrid {
  id: string;
  name: string;
  width: number;
  height: number;
  data: number[];
  resolution: number;
  origin: [number, number, number];
  timestamp: number;
  slam_enabled: boolean;
}

interface ObstacleCheckResult {
  isSafe: boolean;
  obstacleCount: number;
  averageOccupancy: number;
  warnings: string[];
  details: {
    x: number;
    y: number;
    cellX: number;
    cellY: number;
    occupancyValue: number;
  };
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert world coordinates to grid cell coordinates
 */
const worldToGridCoordinates = (
  worldX: number,
  worldY: number,
  grid: OccupancyGrid
): { cellX: number; cellY: number } => {
  const originX = grid.origin[0];
  const originY = grid.origin[1];

  // Convert to grid coordinates
  const cellX = Math.floor((worldX - originX) / grid.resolution);
  const cellY = Math.floor((worldY - originY) / grid.resolution);

  return { cellX, cellY };
};

/**
 * Convert grid cell coordinates to array index
 */
const gridCoordinatesToIndex = (
  cellX: number,
  cellY: number,
  grid: OccupancyGrid
): number => {
  // Handle negative or out-of-bounds coordinates
  if (cellX < 0 || cellX >= grid.width || cellY < 0 || cellY >= grid.height) {
    return -1;
  }

  // Row-major order: index = y * width + x
  return cellY * grid.width + cellX;
};

/**
 * Get occupancy value at world coordinates
 */
const getOccupancyAtWorldCoords = (
  worldX: number,
  worldY: number,
  grid: OccupancyGrid
): number | null => {
  const { cellX, cellY } = worldToGridCoordinates(worldX, worldY, grid);
  const index = gridCoordinatesToIndex(cellX, cellY, grid);

  if (index < 0 || index >= grid.data.length) {
    return null; // Out of bounds
  }

  return grid.data[index];
};

// ============================================================================
// OBSTACLE DETECTION
// ============================================================================

/**
 * Check area around a position for obstacles (using radius)
 * Returns details about the area
 */
const checkObstaclesInRadius = (
  worldX: number,
  worldY: number,
  radius: number, // meters
  grid: OccupancyGrid,
  occupancyThreshold: number = 50 // Value above which is considered obstacle
): ObstacleCheckResult => {
  const warnings: string[] = [];
  let obstacleCount = 0;
  let totalCells = 0;
  let occupancySum = 0;

  // Convert radius to cells
  const radiusCells = Math.ceil(radius / grid.resolution);

  // Convert world position to grid coordinates
  const { cellX: centerCellX, cellY: centerCellY } = worldToGridCoordinates(
    worldX,
    worldY,
    grid
  );

  console.log(`[Obstacle Check] World: (${worldX}, ${worldY})`);
  console.log(`[Obstacle Check] Grid cell: (${centerCellX}, ${centerCellY})`);
  console.log(`[Obstacle Check] Search radius: ${radius}m = ${radiusCells} cells`);

  // Check cells in radius
  for (let dx = -radiusCells; dx <= radiusCells; dx++) {
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      const checkCellX = centerCellX + dx;
      const checkCellY = centerCellY + dy;

      // Only check cells within actual radius distance
      const distanceCells = Math.sqrt(dx * dx + dy * dy);
      if (distanceCells > radiusCells) {
        continue;
      }

      const index = gridCoordinatesToIndex(checkCellX, checkCellY, grid);

      // Skip out-of-bounds
      if (index < 0) {
        warnings.push(`Out of bounds at grid (${checkCellX}, ${checkCellY})`);
        continue;
      }

      const occupancy = grid.data[index];
      totalCells++;
      occupancySum += occupancy;

      // Count obstacles
      if (occupancy > occupancyThreshold) {
        obstacleCount++;
        console.warn(
          `[Obstacle Check] Obstacle found at grid (${checkCellX}, ${checkCellY}): occupancy=${occupancy}`
        );
      }
    }
  }

  const averageOccupancy = totalCells > 0 ? occupancySum / totalCells : 0;
  const occupancyPercentage = (averageOccupancy / 100) * 100;

  // Determine if safe
  const isSafe = obstacleCount === 0 && averageOccupancy < occupancyThreshold;

  if (!isSafe) {
    if (obstacleCount > 0) {
      warnings.push(
        `Found ${obstacleCount} obstacle cells in radius (threshold: occupancy > ${occupancyThreshold})`
      );
    }
    if (averageOccupancy >= occupancyThreshold) {
      warnings.push(
        `Average occupancy ${occupancyPercentage.toFixed(1)}% exceeds threshold`
      );
    }
  }

  const centerOccupancy = getOccupancyAtWorldCoords(worldX, worldY, grid) ?? 0;

  console.log(`[Obstacle Check] Results:`);
  console.log(
    `  - Safe: ${isSafe ? '✓ YES' : '✗ NO'}`
  );
  console.log(`  - Obstacles found: ${obstacleCount}/${totalCells}`);
  console.log(
    `  - Average occupancy: ${occupancyPercentage.toFixed(1)}%`
  );
  console.log(`  - Center occupancy: ${centerOccupancy}`);

  return {
    isSafe,
    obstacleCount,
    averageOccupancy,
    warnings,
    details: {
      x: worldX,
      y: worldY,
      cellX: centerCellX,
      cellY: centerCellY,
      occupancyValue: centerOccupancy,
    },
  };
};

/**
 * Check if a shelf position is safe (no obstacles)
 * This is the main function to use in shelf creation
 */
const isSafeShelfPosition = (
  worldX: number,
  worldY: number,
  grid: OccupancyGrid | null,
  shelfRadius: number = 0.5, // Shelf radius in meters
  occupancyThreshold: number = 50
): { safe: boolean; reason: string } => {
  // If no grid data available, assume safe
  if (!grid) {
    console.warn('[Obstacle Check] No occupancy grid available, assuming safe');
    return { safe: true, reason: 'No occupancy grid data available' };
  }

  // Check for obstacles
  const result = checkObstaclesInRadius(
    worldX,
    worldY,
    shelfRadius,
    grid,
    occupancyThreshold
  );

  if (!result.isSafe) {
    const reason =
      result.warnings.length > 0
        ? result.warnings[0]
        : 'Unknown obstacle detected';
    return { safe: false, reason };
  }

  return { safe: true, reason: 'No obstacles detected' };
};

// ============================================================================
// VISUALIZATION HELPER
// ============================================================================

/**
 * Generate a visual representation of the occupancy grid around a position
 */
const getGridVisualization = (
  worldX: number,
  worldY: number,
  grid: OccupancyGrid,
  viewRadius: number = 2.0 // meters
): string => {
  const viewRadiusCells = Math.ceil(viewRadius / grid.resolution);
  const { cellX: centerCellX, cellY: centerCellY } = worldToGridCoordinates(
    worldX,
    worldY,
    grid
  );

  let visualization = `\n📊 Grid View (${(viewRadius * 2).toFixed(1)}m x ${(viewRadius * 2).toFixed(1)}m):\n`;
  visualization += '   ';

  // Column headers
  for (let i = -viewRadiusCells; i <= viewRadiusCells; i++) {
    visualization += i % 5 === 0 ? `${(i % 10).toString().padEnd(2)}` : '  ';
  }
  visualization += '\n';

  // Grid rows
  for (let dy = viewRadiusCells; dy >= -viewRadiusCells; dy--) {
    visualization += `${dy.toString().padEnd(3)}`;

    for (let dx = -viewRadiusCells; dx <= viewRadiusCells; dx++) {
      const checkCellX = centerCellX + dx;
      const checkCellY = centerCellY + dy;
      const index = gridCoordinatesToIndex(checkCellX, checkCellY, grid);

      let symbol = '?';
      if (index >= 0 && index < grid.data.length) {
        const occupancy = grid.data[index];
        if (occupancy === 0) {
          symbol = '·'; // Free
        } else if (occupancy > 50) {
          symbol = '█'; // Obstacle
        } else if (occupancy > 0) {
          symbol = '▒'; // Partial
        } else if (occupancy < 0) {
          symbol = '?'; // Unknown
        }
      }

      // Highlight center
      if (dx === 0 && dy === 0) {
        symbol = symbol === '·' ? '◉' : 'X';
      }

      visualization += symbol.padEnd(2);
    }
    visualization += `\n`;
  }

  visualization += '\nLegend: · = free, ▒ = partial, █ = obstacle, ◉ = center, ? = unknown\n';

  return visualization;
};

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

export {
  checkObstaclesInRadius,
  isSafeShelfPosition,
  getGridVisualization,
  worldToGridCoordinates,
  gridCoordinatesToIndex,
  getOccupancyAtWorldCoords,
};

export type { OccupancyGrid, ObstacleCheckResult };