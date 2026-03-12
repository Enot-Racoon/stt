import type { WorkerTransport } from './WorkerTransport';

/**
 * Configuration options for DedicatedWorkerTransport.
 */
export interface DedicatedWorkerTransportOptions {
  /**
   * Path to the worker script file.
   */
  workerPath: string;

  /**
   * Optional name for the worker (for debugging purposes).
   */
  name?: string;
}

/**
 * DedicatedWorkerTransport implements the WorkerTransport interface
 * using the Dedicated Worker API (Web Workers).
 *
 * Handles message passing between main thread and worker.
 */
export class DedicatedWorkerTransport implements WorkerTransport {
  private worker: Worker | null = null;
  private messageHandler: ((data: unknown) => void) | null = null;
  private isConnected = false;

  /**
   * Creates a new DedicatedWorkerTransport instance.
   * @param options - Configuration options including worker path
   */
  constructor(private options: DedicatedWorkerTransportOptions) {}

  /**
   * Establish connection to the worker.
   * Creates a new Worker instance and attaches message listeners.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.worker = new Worker(this.options.workerPath, {
        name: this.options.name || 'SpeechWorker',
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        if (this.messageHandler) {
          this.messageHandler(event.data);
        }
      };

      this.worker.onerror = (error: ErrorEvent) => {
        console.error('Worker error:', error);
      };

      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to worker: ${error}`);
    }
  }

  /**
   * Send a message to the worker.
   * @param message - Message to send to the worker
   * @throws Error if worker is not connected
   */
  send(message: unknown): void {
    if (!this.worker || !this.isConnected) {
      throw new Error('Worker is not connected. Call connect() first.');
    }

    this.worker.postMessage(message);
  }

  /**
   * Register a handler for incoming messages from the worker.
   * @param handler - Callback function to handle received messages
   */
  onMessage(handler: (data: unknown) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Terminate the worker connection and clean up resources.
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.messageHandler = null;
    this.isConnected = false;
  }

  /**
   * Check if the worker is connected.
   */
  is_connected(): boolean {
    return this.isConnected;
  }
}
