import { SpeechOptions } from '../types/SpeechOptions';
import { SpeechResult } from '../types/SpeechResult';

/**
 * Interface for speech transcription adapters.
 * Adapters handle the actual transcription logic for different backends.
 */
export interface SpeechAdapter {
  /**
   * Initialize the adapter and prepare for transcription.
   */
  init(options?: SpeechOptions): Promise<void>;

  /**
   * Transcribe audio data to text.
   * @param audio - Audio blob to transcribe
   */
  transcribe(audio: Blob): Promise<SpeechResult>;

  /**
   * Clean up resources and destroy the adapter.
   */
  destroy(): Promise<void>;
}
