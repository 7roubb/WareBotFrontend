/**
 * Integration module for real-time task system
 * Initializes all WebSocket handlers, error handling, and state management
 */

import { connectTaskWebSocket, onTaskWebSocketEvent } from './taskWebsocket';
import { errorHandler, recoveryHandler, ErrorType } from '../utils/errorHandling';

class RealtimeIntegration {
  private isInitialized = false;

  /**
   * Initialize all real-time systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Realtime] Already initialized');
      return;
    }

    try {
      console.log('[Realtime] Initializing real-time task system...');

      // Connect WebSocket with error handling
      await this.setupWebSocketConnection();

      // Setup error handlers
      this.setupErrorHandlers();

      // Setup recovery procedures
      this.setupRecoveryProcedures();

      this.isInitialized = true;
      console.log('[Realtime] Initialization complete');
    } catch (error) {
      errorHandler.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Setup WebSocket connection with retry logic
   */
  private async setupWebSocketConnection(): Promise<void> {
    try {
      const socket = connectTaskWebSocket();

      if (!socket) {
        throw new Error('Failed to create WebSocket instance');
      }

      // Wait for connection with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        if (socket.connected) {
          clearTimeout(timeout);
          resolve();
        } else {
          socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }
      });

      console.log('[Realtime] WebSocket connection established');
    } catch (error) {
      console.error('[Realtime] Failed to setup WebSocket:', error);
      throw error;
    }
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Listen for WebSocket errors
    onTaskWebSocketEvent('error', (error: unknown) => {
      console.warn('[Realtime] WebSocket error:', error);
      errorHandler.handle(error, ErrorType.CONNECTION);
    });

    // Listen for disconnections
    onTaskWebSocketEvent('disconnect', (data: unknown) => {
      const typedData = data as Record<string, unknown>;
      console.warn('[Realtime] WebSocket disconnected:', typedData?.reason);
      errorHandler.handle(
        new Error(`Disconnected: ${typedData?.reason}`),
        ErrorType.CONNECTION
      );
    });

    // Global error handler for unhandled rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Realtime] Unhandled promise rejection:', event.reason);
      errorHandler.handle(event.reason, ErrorType.UNKNOWN);
    });

    // Global error handler
    window.addEventListener('error', (event) => {
      console.error('[Realtime] Global error:', event.error);
      errorHandler.handle(event.error, ErrorType.UNKNOWN);
    });
  }

  /**
   * Setup recovery procedures
   */
  private setupRecoveryProcedures(): void {
    // Subscribe to error events and attempt recovery
    errorHandler.subscribe((error) => {
      console.log('[Realtime] Error recovery handler triggered:', error.type);

      switch (error.type) {
        case ErrorType.CONNECTION:
          this.recoverFromConnectionError();
          break;
        case ErrorType.TIMEOUT:
          this.recoverFromTimeoutError();
          break;
        case ErrorType.NETWORK:
          this.recoverFromNetworkError();
          break;
        default:
          console.log('[Realtime] No specific recovery for error type:', error.type);
      }
    });
  }

  /**
   * Recover from connection error
   */
  private async recoverFromConnectionError(): Promise<void> {
    console.log('[Realtime] Attempting to recover from connection error...');

    try {
      await recoveryHandler.retryWithBackoff(
        () => {
          return new Promise<void>((resolve, reject) => {
            const socket = connectTaskWebSocket();
            if (socket?.connected) {
              resolve();
            } else {
              reject(new Error('Still not connected'));
            }
          });
        },
        3,
        500,
        5000
      );

      console.log('[Realtime] Connection recovered successfully');
    } catch (error) {
      console.error('[Realtime] Failed to recover connection:', error);
    }
  }

  /**
   * Recover from timeout error
   */
  private async recoverFromTimeoutError(): Promise<void> {
    console.log('[Realtime] Recovering from timeout...');
    // Could implement automatic retry of timed-out operations
  }

  /**
   * Recover from network error
   */
  private async recoverFromNetworkError(): Promise<void> {
    console.log('[Realtime] Waiting for network recovery...');

    await new Promise<void>((resolve) => {
      const onOnline = () => {
        window.removeEventListener('online', onOnline);
        console.log('[Realtime] Network recovered');
        resolve();
      };

      if (navigator.onLine) {
        resolve();
      } else {
        window.addEventListener('online', onOnline);
      }
    });

    // Attempt to reconnect
    await this.recoverFromConnectionError();
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Create singleton instance
export const realtimeIntegration = new RealtimeIntegration();

export default realtimeIntegration;
