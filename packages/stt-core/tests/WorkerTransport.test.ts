import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { DedicatedWorkerTransport } from '../src/worker/DedicatedWorkerTransport';
import { WorkerTransportFactory, createWorkerTransport } from '../src/worker/WorkerTransportFactory';
import type { WorkerResponse } from '../src/types/WorkerProtocol';

// Mock Worker for testing
class MockWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  messages: unknown[] = [];

  constructor(_script: string, _options?: { name?: string; type?: string }) {}

  postMessage(message: unknown): void {
    this.messages.push(message);

    // Simulate worker response based on message type
    setTimeout(() => {
      if (this.onmessage) {
        const msg = message as { type: string };
        let response: WorkerResponse;

        switch (msg.type) {
          case 'INIT_MODEL':
            response = { type: 'MODEL_READY', payload: { success: true } };
            break;
          case 'TRANSCRIBE':
            response = {
              type: 'RESULT',
              payload: { text: 'dummy transcription', confidence: 1.0, language: 'en' },
            };
            break;
          case 'DESTROY':
            response = { type: 'ERROR', payload: { message: 'Worker destroyed' } };
            break;
          default:
            response = { type: 'ERROR', payload: { message: 'Unknown message type' } };
        }

        this.onmessage({ data: response } as MessageEvent<unknown>);
      }
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}

// Replace global Worker with MockWorker for tests
const OriginalWorker = global.Worker;

describe('DedicatedWorkerTransport', () => {
  let transport: DedicatedWorkerTransport;

  beforeEach(() => {
    // @ts-ignore - Mock Worker for testing
    global.Worker = MockWorker;
    transport = new DedicatedWorkerTransport({ workerPath: '/mock/worker.js' });
  });

  afterEach(() => {
    transport.destroy();
    global.Worker = OriginalWorker;
  });

  test('connects successfully', async () => {
    await expect(transport.connect()).resolves.toBeUndefined();
    expect(transport.is_connected()).toBe(true);
  });

  test('send() sends messages to worker', async () => {
    await transport.connect();

    const message = { type: 'INIT_MODEL' as const, payload: {} };
    expect(() => transport.send(message)).not.toThrow();
  });

  test('send() throws error when not connected', () => {
    const message = { type: 'INIT_MODEL' as const, payload: {} };
    expect(() => transport.send(message)).toThrow('Worker is not connected');
  });

  test('worker response is received', async () => {
    await transport.connect();

    const receivedMessages: unknown[] = [];
    transport.onMessage((data) => {
      receivedMessages.push(data);
    });

    transport.send({ type: 'INIT_MODEL' as const, payload: {} });

    // Wait for async response
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toEqual({
      type: 'MODEL_READY',
      payload: { success: true },
    });
  });

  test('destroy() terminates worker', async () => {
    await transport.connect();
    expect(transport.is_connected()).toBe(true);

    transport.destroy();
    expect(transport.is_connected()).toBe(false);
  });

  test('onMessage registers handler', async () => {
    await transport.connect();

    const mockHandler = mock((data: unknown) => {
      // Handler logic
    });

    transport.onMessage(mockHandler);
    transport.send({ type: 'INIT_MODEL' as const, payload: {} });

    // Wait for async response
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockHandler).toHaveBeenCalled();
  });

  test('multiple connect calls do not create multiple workers', async () => {
    await transport.connect();
    const firstConnect = transport.is_connected();

    await transport.connect();
    const secondConnect = transport.is_connected();

    expect(firstConnect).toBe(true);
    expect(secondConnect).toBe(true);
  });
});

describe('WorkerTransportFactory', () => {
  beforeEach(() => {
    // @ts-ignore - Mock Worker for testing
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
  });

  test('creates DedicatedWorkerTransport', () => {
    const transport = WorkerTransportFactory.create({ workerPath: '/mock/worker.js' });
    expect(transport).toBeInstanceOf(DedicatedWorkerTransport);
  });

  test('passes worker path to transport', async () => {
    const transport = WorkerTransportFactory.create({
      workerPath: '/custom/path/worker.js',
      name: 'TestWorker',
    });

    await transport.connect();
    expect(transport.is_connected()).toBe(true);

    transport.destroy();
  });
});

describe('createWorkerTransport', () => {
  beforeEach(() => {
    // @ts-ignore - Mock Worker for testing
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
  });

  test('creates transport instance', () => {
    const transport = createWorkerTransport({ workerPath: '/mock/worker.js' });
    expect(transport).toBeDefined();
    expect(typeof transport.connect).toBe('function');
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.onMessage).toBe('function');
    expect(typeof transport.destroy).toBe('function');
  });
});
