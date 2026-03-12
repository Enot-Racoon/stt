import { SpeechOptions } from '../types/SpeechOptions';
import { SpeechResult } from '../types/SpeechResult';
import { SpeechState } from '../types/SpeechState';

/**
 * Event handler type for engine events.
 */
export type EventHandler = (data?: unknown) => void;

/**
 * Main speech engine interface for controlling transcription.
 */
export interface SpeechEngine {
  /**
   * Initialize the speech engine with optional configuration.
   */
  init(options?: SpeechOptions): Promise<void>;

  /**
   * Start recording audio for transcription.
   */
  start(): Promise<void>;

  /**
   * Stop recording and return the transcription result.
   */
  stop(): Promise<SpeechResult>;

  /**
   * Cancel the current recording session without transcription.
   */
  cancel(): void;

  /**
   * Subscribe to engine events.
   * @param event - Event name (e.g., 'statechange', 'result', 'error')
   * @param handler - Callback function to handle the event
   */
  on(event: string, handler: EventHandler): void;

  /**
   * Get the current state of the engine.
   */
  getState(): SpeechState;
}
