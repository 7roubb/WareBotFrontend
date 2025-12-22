/**
 * Error handling and recovery utilities for real-time task system
 */

export enum ErrorType {
  CONNECTION = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  INVALID_DATA = 'INVALID_DATA_ERROR',
  SERVER = 'SERVER_ERROR',
  NETWORK = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: unknown;
  timestamp: Date;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: AppError[] = [];
  private maxErrorHistory = 100;
  private errorCallbacks: Array<(error: AppError) => void> = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log an error
   */
  handle(error: unknown, type?: ErrorType): AppError {
    const appError: AppError = {
      type: type || ErrorType.UNKNOWN,
      message: this.extractMessage(error),
      details: error,
      timestamp: new Date(),
    };

    this.addError(appError);
    this.notifyCallbacks(appError);
    this.logError(appError);

    return appError;
  }

  /**
   * Handle connection errors specifically
   */
  handleConnectionError(error: unknown): AppError {
    return this.handle(error, ErrorType.CONNECTION);
  }

  /**
   * Handle timeout errors
   */
  handleTimeoutError(message: string = 'Operation timed out'): AppError {
    return this.handle(new Error(message), ErrorType.TIMEOUT);
  }

  /**
   * Handle invalid data errors
   */
  handleInvalidDataError(message: string, data?: unknown): AppError {
    const error = new Error(message);
    return this.handle({ ...error, data }, ErrorType.INVALID_DATA);
  }

  /**
   * Handle server errors
   */
  handleServerError(statusCode: number, message: string): AppError {
    const error = new Error(`Server Error ${statusCode}: ${message}`);
    const appError = this.handle(error, ErrorType.SERVER);
    appError.code = `HTTP_${statusCode}`;
    return appError;
  }

  /**
   * Handle network errors
   */
  handleNetworkError(error: unknown): AppError {
    return this.handle(error, ErrorType.NETWORK);
  }

  /**
   * Get error history
   */
  getErrorHistory(): AppError[] {
    return [...this.errors];
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errors = [];
  }

  /**
   * Subscribe to error events
   */
  subscribe(callback: (error: AppError) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Extract error message from various error types
   */
  private extractMessage(error: unknown): string {
    if (!error) return 'Unknown error occurred';

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      if (obj.message) return String(obj.message);
      if (obj.msg) return String(obj.msg);
      if (obj.error) return String(obj.error);
    }

    return JSON.stringify(error);
  }

  /**
   * Add error to history
   */
  private addError(error: AppError): void {
    this.errors.push(error);
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory);
    }
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(error: AppError): void {
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(error);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
  }

  /**
   * Log error to console
   */
  private logError(error: AppError): void {
    const style = 'color: red; font-weight: bold;';
    console.group(`%c[${error.type}] ${error.message}`, style);
    console.log('Details:', error.details);
    console.log('Timestamp:', error.timestamp);
    console.groupEnd();
  }
}

/**
 * Recovery strategies for different error types
 */
export class RecoveryHandler {
  private static instance: RecoveryHandler;
  private retryStrategies: Map<ErrorType, RetryStrategy> = new Map();

  private constructor() {
    this.initializeDefaultStrategies();
  }

  static getInstance(): RecoveryHandler {
    if (!RecoveryHandler.instance) {
      RecoveryHandler.instance = new RecoveryHandler();
    }
    return RecoveryHandler.instance;
  }

  /**
   * Retry an operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelay: number = 1000,
    maxDelay: number = 10000
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Recovery] Attempt ${attempt}/${maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[Recovery] Attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxAttempts) {
          await this.sleep(delay);
          delay = Math.min(delay * 2, maxDelay);
        }
      }
    }

    throw lastError || new Error('Operation failed after all retry attempts');
  }

  /**
   * Get recovery action for error type
   */
  getRecoveryAction(errorType: ErrorType): string {
    const strategy = this.retryStrategies.get(errorType);
    return strategy?.action || 'Please try again later';
  }

  /**
   * Register custom retry strategy
   */
  registerStrategy(errorType: ErrorType, strategy: RetryStrategy): void {
    this.retryStrategies.set(errorType, strategy);
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialize default retry strategies
   */
  private initializeDefaultStrategies(): void {
    this.retryStrategies.set(ErrorType.CONNECTION, {
      maxRetries: 5,
      initialDelay: 500,
      action: 'Attempting to reconnect to the server...',
    });

    this.retryStrategies.set(ErrorType.TIMEOUT, {
      maxRetries: 3,
      initialDelay: 2000,
      action: 'The request took too long. Retrying...',
    });

    this.retryStrategies.set(ErrorType.NETWORK, {
      maxRetries: 5,
      initialDelay: 1000,
      action: 'Network unavailable. Retrying when connection is restored...',
    });

    this.retryStrategies.set(ErrorType.SERVER, {
      maxRetries: 3,
      initialDelay: 2000,
      action: 'Server error. Please try again later.',
    });

    this.retryStrategies.set(ErrorType.INVALID_DATA, {
      maxRetries: 0,
      initialDelay: 0,
      action: 'Invalid data received. Please check your input.',
    });
  }
}

export interface RetryStrategy {
  maxRetries: number;
  initialDelay: number;
  action: string;
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate task map data structure
   */
  static validateTaskMapData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;
    const required = ['task_id', 'status', 'robot', 'shelf'];
    const hasRequired = required.every((key) => key in obj);

    if (!hasRequired) return false;

    const robot = obj.robot as Record<string, unknown>;
    const shelf = obj.shelf as Record<string, unknown>;

    if (
      !robot ||
      typeof robot.x !== 'number' ||
      typeof robot.y !== 'number'
    ) {
      return false;
    }

    if (
      !shelf ||
      typeof shelf.x !== 'number' ||
      typeof shelf.y !== 'number'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate robot position update
   */
  static validateRobotPositionUpdate(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.robot_x === 'number' &&
      typeof obj.robot_y === 'number' &&
      typeof obj.status === 'string'
    );
  }

  /**
   * Validate task status change
   */
  static validateTaskStatusChange(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;
    const validStatuses = [
      'PENDING',
      'ASSIGNED',
      'MOVING_TO_SHELF',
      'PICKING',
      'MOVING_TO_DROP',
      'DROPPING',
      'RETURNING',
      'COMPLETED',
    ];

    return (
      typeof obj.task_id === 'string' &&
      typeof obj.old_status === 'string' &&
      typeof obj.new_status === 'string' &&
      validStatuses.includes(String(obj.new_status))
    );
  }

  /**
   * Sanitize numeric values
   */
  static sanitizeNumber(value: unknown, defaultValue: number = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  }

  /**
   * Sanitize string values
   */
  static sanitizeString(value: unknown, defaultValue: string = ''): string {
    if (typeof value === 'string') return value.trim();
    return defaultValue;
  }
}

// Export singletons
export const errorHandler = ErrorHandler.getInstance();
export const recoveryHandler = RecoveryHandler.getInstance();

export default {
  errorHandler,
  recoveryHandler,
  ErrorType,
  ValidationUtils,
};
