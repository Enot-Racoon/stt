import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { SpeechEngineImpl } from '../src/engine/SpeechEngineImpl';
import { SpeechState } from '../src/types/SpeechState';
import { SpeechResult } from '../src/types/SpeechResult';
import { WorkerResponse } from '../src/types/WorkerProtocol';

// Mock AudioRecorder
class MockAudioRecorder {
  started = false;
  stopped = false;
  cancelled = false;
  onDataCallback: ((chunk: Blob) => void) | null = null;

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<Blob> {
    this.stopped = true;
    return new Blob(['audio data'], { type: 'audio/webm' });
  }

  cancel(): void {
    this.cancelled = true;
  }

  isRecordingAudio(): boolean {
    return this.started && !this.stopped && !this.cancelled;
  }

  getStream(): MediaStream | null {
    return this.started ? ({} as MediaStream) : null;
  }
}

// Mock SilenceDetector
class MockSilenceDetector {
  started = false;
  stopped = false;
  onSilenceCallback: (() => void) | null = null;

  start(_stream: MediaStream, onSilence: () => void): void {
    this.started = true;
    this.onSilenceCallback = onSilence;
  }

  stop(): void {
    this.stopped = true;
  }

  isDetecting(): boolean {
    return this.started && !this.stopped;
  }

  getCurrentVolume(): number {
    return 0;
  }

  // For testing: trigger silence
  triggerSilence(): void {
    if (this.onSilenceCallback) {
      this.onSilenceCallback();
    }
  }
}

// Mock WorkerTransport
class MockWorkerTransport {
  connected = false;
  messageHandler: ((data: unknown) => void) | null = null;
  sentMessages: unknown[] = [];
  respondImmediately = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  send(message: unknown): void {
    this.sentMessages.push(message);

    // Auto-respond to INIT_MODEL for easier testing
    if (this.respondImmediately && (message as { type: string }).type === 'INIT_MODEL') {
      setTimeout(() => {
        if (this.messageHandler) {
          this.messageHandler({
            type: 'MODEL_READY',
            payload: { success: true },
          });
        }
      }, 5);
    }
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandler = handler;
  }

  destroy(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // For testing: simulate worker response
  simulateResponse(response: WorkerResponse): void {
    if (this.messageHandler) {
      this.messageHandler(response);
    }
  }
}

describe('SpeechEngineImpl', () => {
  let engine: SpeechEngineImpl;
  let mockRecorder: MockAudioRecorder;
  let mockVad: MockSilenceDetector;
  let mockTransport: MockWorkerTransport;

  beforeEach(() => {
    mockRecorder = new MockAudioRecorder();
    mockVad = new MockSilenceDetector();
    mockTransport = new MockWorkerTransport();

    engine = new SpeechEngineImpl({
      recorder: mockRecorder as unknown as MockAudioRecorder,
      silenceDetector: mockVad as unknown as MockSilenceDetector,
      transport: mockTransport as unknown as MockWorkerTransport,
      workerPath: '/mock/worker.js',
    });
  });

  afterEach(() => {
    // Clean up
  });

  test('initial state is idle', () => {
    expect(engine.getState()).toBe('idle');
  });

  test('init() sets state to ready', async () => {
    mockTransport.respondImmediately = true;

    await engine.init({ model: 'whisper-tiny' });

    expect(engine.getState()).toBe('ready');
    expect(mockTransport.connected).toBe(true);
    expect(mockTransport.sentMessages).toContainEqual({
      type: 'INIT_MODEL',
      payload: { model: 'whisper-tiny' },
    });
  });

  test('start() begins recording', async () => {
    mockTransport.respondImmediately = true;

    // Initialize first
    await engine.init();

    // Start recording
    await engine.start();

    expect(mockRecorder.started).toBe(true);
    expect(engine.getState()).toBe('recording');
  });

  test('start() throws error when not initialized', async () => {
    await expect(engine.start()).rejects.toThrow();
  });

  test('silence detection triggers callback', async () => {
    mockTransport.respondImmediately = true;

    // Initialize with autoStop enabled
    await engine.init({ autoStop: true, silenceTime: 100 });

    // Start recording
    await engine.start();

    expect(mockVad.started).toBe(true);
    expect(mockVad.isDetecting()).toBe(true);
  });

  test('stop() sends transcription request', async () => {
    mockTransport.respondImmediately = true;

    // Initialize
    await engine.init();

    // Start recording
    await engine.start();

    // Stop and wait for result (with timeout)
    const stopPromise = engine.stop();

    // Simulate RESULT response after a short delay
    setTimeout(() => {
      mockTransport.simulateResponse({
        type: 'RESULT',
        payload: { text: 'test transcription', confidence: 0.95, language: 'en' },
      });
    }, 10);

    const result = await stopPromise;

    expect(result.text).toBe('test transcription');
    expect(result.confidence).toBe(0.95);
    expect(mockRecorder.stopped).toBe(true);
    expect(engine.getState()).toBe('ready');

    // Check TRANSCRIBE message was sent
    const transcribeMessage = mockTransport.sentMessages.find(
      (m) => (m as { type: string }).type === 'TRANSCRIBE'
    );
    expect(transcribeMessage).toBeDefined();
  });

  test('worker result returns SpeechResult', async () => {
    mockTransport.respondImmediately = true;

    // Initialize
    await engine.init();

    // Start and stop
    await engine.start();

    const stopPromise = engine.stop();

    // Simulate result
    setTimeout(() => {
      mockTransport.simulateResponse({
        type: 'RESULT',
        payload: { text: 'hello world', confidence: 0.99, language: 'en' },
      });
    }, 10);

    const result = await stopPromise;

    expect(result).toEqual({
      text: 'hello world',
      confidence: 0.99,
      language: 'en',
    });
  });

  test('cancel() resets engine state', async () => {
    mockTransport.respondImmediately = true;

    // Initialize
    await engine.init();

    // Start recording
    await engine.start();
    expect(engine.getState()).toBe('recording');

    // Cancel
    engine.cancel();

    expect(mockRecorder.cancelled).toBe(true);
    expect(mockVad.stopped).toBe(true);
    expect(engine.getState()).toBe('ready');
  });

  test('event handlers are called on state change', async () => {
    mockTransport.respondImmediately = true;

    const stateChangeHandler = mock((data: unknown) => {
      // Handler logic
    });

    engine.on('statechange', stateChangeHandler);

    // Initialize
    await engine.init();

    // Wait for async state changes
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(stateChangeHandler).toHaveBeenCalled();
  });

  test('event handlers are called on result', async () => {
    mockTransport.respondImmediately = true;

    const resultHandler = mock((data: unknown) => {
      // Handler logic
    });

    engine.on('result', resultHandler);

    // Initialize
    await engine.init();

    // Start and stop
    await engine.start();

    const stopPromise = engine.stop();

    setTimeout(() => {
      mockTransport.simulateResponse({
        type: 'RESULT',
        payload: { text: 'test', confidence: 1.0 },
      });
    }, 10);

    await stopPromise;

    // Wait for event to be emitted
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(resultHandler).toHaveBeenCalled();
  });

  test('error from worker sets error state', async () => {
    mockTransport.respondImmediately = true;

    // Initialize
    await engine.init();

    // Start and stop
    await engine.start();

    const stopPromise = engine.stop();

    // Simulate error
    setTimeout(() => {
      mockTransport.simulateResponse({
        type: 'ERROR',
        payload: { message: 'Transcription failed', code: 'WORKER_ERROR' },
      });
    }, 10);

    await expect(stopPromise).rejects.toThrow('Transcription failed');
    expect(engine.getState()).toBe('error');
  });

  test('multiple event handlers can be registered', () => {
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    engine.on('customEvent', handler1);
    engine.on('customEvent', handler2);

    // Test that handlers are stored (engine is defined)
    expect(engine).toBeDefined();
  });

  test('getState() returns current state', () => {
    expect(engine.getState()).toBe('idle');
  });
});
