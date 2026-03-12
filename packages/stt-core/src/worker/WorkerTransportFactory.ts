import { DedicatedWorkerTransport } from './DedicatedWorkerTransport';
import type { WorkerTransport } from './WorkerTransport';

/**
 * Configuration options for creating a worker transport.
 */
export interface WorkerTransportConfig {
  /**
   * Path to the worker script file.
   */
  workerPath: string;

  /**
   * Optional name for the worker.
   */
  name?: string;
}

/**
 * WorkerTransportFactory creates the appropriate transport implementation.
 *
 * Currently supports DedicatedWorkerTransport only.
 * Structure allows adding SharedWorkerTransport in the future.
 */
export class WorkerTransportFactory {
  /**
   * Create a worker transport instance.
   * @param config - Configuration for the worker transport
   * @returns A WorkerTransport instance
   */
  static create(config: WorkerTransportConfig): WorkerTransport {
    return new DedicatedWorkerTransport({
      workerPath: config.workerPath,
      name: config.name,
    });
  }
}

/**
 * Convenience function to create a worker transport.
 * @param config - Configuration for the worker transport
 * @returns A WorkerTransport instance
 */
export function createWorkerTransport(config: WorkerTransportConfig): WorkerTransport {
  return WorkerTransportFactory.create(config);
}
