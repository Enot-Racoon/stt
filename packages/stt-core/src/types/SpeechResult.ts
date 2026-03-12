/**
 * Structure returned by the transcription engine.
 */
export interface SpeechResult {
  /**
   * The transcribed text.
   */
  text: string;

  /**
   * Confidence score of the transcription (0 to 1).
   */
  confidence?: number;

  /**
   * The detected or specified language code.
   */
  language?: string;
}
