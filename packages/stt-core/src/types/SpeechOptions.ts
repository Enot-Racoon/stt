/**
 * Configuration options for the speech engine.
 */
export interface SpeechOptions {
  /**
   * The Whisper model to use for transcription.
   */
  model?: 'whisper-tiny' | 'whisper-base';

  /**
   * The language code for transcription (e.g., 'en', 'ru').
   */
  language?: string;

  /**
   * Automatically stop recording when silence is detected.
   */
  autoStop?: boolean;

  /**
   * Time in milliseconds to wait for silence before auto-stopping.
   */
  silenceTime?: number;

  /**
   * Enable noise suppression for better audio quality.
   */
  noiseSuppression?: boolean;

  /**
   * Enable echo cancellation for better audio quality.
   */
  echoCancellation?: boolean;
}
