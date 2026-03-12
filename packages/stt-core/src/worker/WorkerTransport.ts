/**
 * Interface for worker transport communication.
 * Handles message passing between main thread and web worker.
 */
export interface WorkerTransport {
  /**
   * Establish connection to the worker.
   */
  connect(): Promise<void>;

  /**
   * Send a message to the worker.
   * @param message - Message to send
   */
  send(message: unknown): void;

  /**
   * Register a handler for incoming messages from the worker.
   * @param handler - Callback function to handle received messages
   */
  onMessage(handler: (data: unknown) => void): void;

  /**
   * Terminate the worker connection and clean up resources.
   */
  destroy(): void;
}
