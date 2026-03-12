import { SpeechEngine, EventHandler } from './SpeechEngine';
import { SpeechOptions } from '../types/SpeechOptions';
import { SpeechResult } from '../types/SpeechResult';
import { SpeechState } from '../types/SpeechState';
import { WorkerRequest, WorkerResponse } from '../types/WorkerProtocol';
import { AudioRecorder } from '../audio/AudioRecorder';
import { SilenceDetector } from '../vad/SilenceDetector';
import { WorkerTransport } from '../worker/WorkerTransport';
import { createWorkerTransport } from '../worker/WorkerTransportFactory';

/**
 * Configuration for SpeechEngineImpl.
 */
export interface SpeechEngineConfig {
  /**
   * Path to the speech worker script.
   */
  workerPath?: string;

  /**
   * Audio recorder instance (for dependency injection).
   */
  recorder?: AudioRecorder;

  /**
   * Silence detector instance (for dependency injection).
   */
  silenceDetector?: SilenceDetector;

  /**
   * Worker transport instance (for dependency injection).
   */
  transport?: WorkerTransport;
}

/**
 * SpeechEngineImpl orchestrates audio recording, silence detection, and worker communication.
 *
 * Manages the speech recognition lifecycle:
 * 1. Initialize worker and model
 * 2. Start recording
 * 3. Detect silence (optional auto-stop)
 * 4. Send audio to worker
 * 5. Return transcription result
 */
export class SpeechEngineImpl implements SpeechEngine {
  private state: SpeechState = 'idle';
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private options: SpeechOptions = {};

  private recorder: AudioRecorder | null = null;
  private silenceDetector: SilenceDetector | null = null;
  private transport: WorkerTransport | null = null;

  private pendingResultResolver: ((result: SpeechResult) => void) | null = null;
  private pendingResultRejecter: ((error: Error) => void) | null = null;
  private silenceHandler: (() => void) | null = null;

  /**
   * Creates a new SpeechEngineImpl instance.
   * @param config - Configuration options including dependencies for testing
   */
  constructor(private config: SpeechEngineConfig = {}) {}

  /**
   * Initialize the speech engine.
   * Connects worker transport and loads the model.
   * @param options - Speech recognition options
   */
  async init(options?: SpeechOptions): Promise<void> {
    this.options = options || {};
    this.setState('initializing');

    try {
      // Initialize worker transport
      this.transport = this.config.transport || this.createTransport();
      await this.transport.connect();

      // Set up message handler
      this.transport.onMessage((message) => {
        this.handleWorkerMessage(message as WorkerResponse);
      });

      // Send INIT_MODEL request
      const initRequest: WorkerRequest = {
        type: 'INIT_MODEL',
        payload: this.options,
      };
      this.transport.send(initRequest);

      // Wait for MODEL_READY response (will be handled by handleWorkerMessage)
      await this.waitForModelReady();

      // Initialize audio recorder
      this.recorder = this.config.recorder || new AudioRecorder({
        onData: (chunk) => this.handleAudioChunk(chunk),
      });

      // Initialize silence detector
      this.silenceDetector = this.config.silenceDetector || new SilenceDetector({
        threshold: 0.01,
        silenceTime: this.options.silenceTime || 2000,
      });

      this.setState('ready');
    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to initialize speech engine: ${error}`);
    }
  }

  /**
   * Start recording audio.
   */
  async start(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start recording in state: ${this.state}`);
    }

    try {
      this.setState('recording');

      // Start audio recording
      if (this.recorder) {
        await this.recorder.start();
      }

      // Start silence detection if autoStop is enabled
      if (this.options.autoStop && this.recorder && this.silenceDetector) {
        const stream = this.recorder.getStream();
        if (stream) {
          this.silenceHandler = () => {
            this.handleSilenceDetected();
          };
          this.silenceDetector.start(stream, this.silenceHandler);
        }
      }

      this.emit('start');
    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  /**
   * Stop recording and return transcription result.
   */
  async stop(): Promise<SpeechResult> {
    if (this.state !== 'recording' && this.state !== 'ready') {
      throw new Error(`Cannot stop recording in state: ${this.state}`);
    }

    try {
      // Stop silence detector
      if (this.silenceDetector) {
        this.silenceDetector.stop();
        this.silenceHandler = null;
      }

      // Stop recording and get audio blob
      if (!this.recorder) {
        throw new Error('Recorder not initialized');
      }

      const audioBlob = await this.recorder.stop();

      // Send to worker for transcription
      return await this.transcribeAudio(audioBlob);
    } catch (error) {
      this.setState('error');
      throw new Error(`Failed to stop recording: ${error}`);
    }
  }

  /**
   * Cancel recording without transcription.
   */
  cancel(): void {
    // Stop silence detector
    if (this.silenceDetector) {
      this.silenceDetector.stop();
      this.silenceHandler = null;
    }

    // Cancel recording
    if (this.recorder) {
      this.recorder.cancel();
    }

    // Reset state to ready
    this.setState('ready');
    this.emit('cancel');
  }

  /**
   * Subscribe to engine events.
   * @param event - Event name
   * @param handler - Event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Get current engine state.
   */
  getState(): SpeechState {
    return this.state;
  }

  /**
   * Create worker transport instance.
   */
  private createTransport(): WorkerTransport {
    const workerPath = this.config.workerPath || '/speech.worker.js';
    return createWorkerTransport({ workerPath });
  }

  /**
   * Wait for MODEL_READY response from worker.
   */
  private waitForModelReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Model initialization timeout'));
      }, 30000);

      // Store resolver for handleWorkerMessage to use
      const checkState = () => {
        if (this.state === 'ready') {
          clearTimeout(timeout);
          resolve();
        } else if (this.state === 'error') {
          clearTimeout(timeout);
          reject(new Error('Model initialization failed'));
        } else {
          setTimeout(checkState, 100);
        }
      };
      checkState();
    });
  }

  /**
   * Send audio to worker for transcription.
   */
  private async transcribeAudio(audioBlob: Blob): Promise<SpeechResult> {
    this.setState('processing');

    return new Promise<SpeechResult>((resolve, reject) => {
      this.pendingResultResolver = resolve;
      this.pendingResultRejecter = reject;

      const transcribeRequest: WorkerRequest = {
        type: 'TRANSCRIBE',
        payload: audioBlob,
      };

      if (this.transport) {
        this.transport.send(transcribeRequest);
      }

      // Timeout for transcription
      setTimeout(() => {
        if (this.pendingResultRejecter) {
          this.pendingResultRejecter(new Error('Transcription Timeout'));
          this.pendingResultResolver = null;
          this.pendingResultRejecter = null;
          this.setState('ready');
        }
      }, 60000);
    });
  }

  /**
   * Handle worker messages.
   */
  private handleWorkerMessage(message: WorkerResponse): void {
    switch (message.type) {
      case 'MODEL_READY':
        // Model is ready, update state
        if (this.state === 'initializing') {
          this.setState('ready');
        }
        this.emit('modelReady', message.payload);
        break;

      case 'RESULT':
        // Transcription result received
        if (this.pendingResultResolver) {
          this.pendingResultResolver(message.payload);
          this.pendingResultResolver = null;
          this.pendingResultRejecter = null;
          this.setState('ready');
          this.emit('result', message.payload);
        }
        break;

      case 'ERROR':
        // Error from worker
        const error = new Error(message.payload.message);
        if (this.pendingResultRejecter) {
          this.pendingResultRejecter(error);
          this.pendingResultResolver = null;
          this.pendingResultRejecter = null;
        }
        this.setState('error');
        this.emit('error', error);
        break;
    }
  }

  /**
   * Handle silence detection (auto-stop).
   */
  private handleSilenceDetected(): void {
    this.emit('silenceDetected');
    // Auto-stop is handled by the engine user calling stop()
  }

  /**
   * Handle audio data chunks.
   */
  private handleAudioChunk(_chunk: Blob): void {
    this.emit('data');
  }

  /**
   * Update engine state and emit event.
   */
  private setState(newState: SpeechState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('statechange', { oldState, newState });
  }

  /**
   * Emit event to all registered handlers.
   */
  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
