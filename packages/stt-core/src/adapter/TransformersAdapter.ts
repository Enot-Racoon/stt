import type { SpeechAdapter } from './SpeechAdapter';
import type { SpeechOptions } from '../types/SpeechOptions';
import type { SpeechResult } from '../types/SpeechResult';

/**
 * Lazy-loaded pipeline type from transformers.js.
 * Using type-only import to avoid bundling issues.
 */
type PipelineType = (audio: Float32Array | Blob, options?: { language?: string; task?: string }) => Promise<{ text: string }>;

/**
 * Module type for dynamic import of transformers.js.
 */
interface TransformersModule {
  pipeline: (task: string, model: string) => Promise<PipelineType>;
}

/**
 * TransformersAdapter implements SpeechAdapter using transformers.js.
 *
 * Uses Whisper model for automatic speech recognition.
 * Runs entirely in the worker thread.
 */
export class TransformersAdapter implements SpeechAdapter {
  private pipeline: PipelineType | null = null;
  private model: string = 'Xenova/whisper-tiny';
  private isInitialized = false;

  /**
   * Initialize the adapter and load the Whisper model.
   * @param options - Speech recognition options including model selection
   */
  async init(options?: SpeechOptions): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Select model based on options
      if (options?.model === 'whisper-base') {
        this.model = 'Xenova/whisper-base';
      }

      // Dynamically import transformers.js
      const { pipeline } = await import('@xenova/transformers') as TransformersModule;

      // Load the ASR pipeline
      this.pipeline = await pipeline('automatic-speech-recognition', this.model);
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize TransformersAdapter: ${error}`);
    }
  }

  /**
   * Transcribe audio blob to text using Whisper.
   * @param audio - Audio blob to transcribe
   * @returns Transcription result with text and confidence
   */
  async transcribe(audio: Blob): Promise<SpeechResult> {
    if (!this.pipeline || !this.isInitialized) {
      throw new Error('Adapter not initialized. Call init() first.');
    }

    try {
      // Convert blob to ArrayBuffer for processing
      const arrayBuffer = await audio.arrayBuffer();
      const audioData = new Float32Array(arrayBuffer.byteLength / 4);
      const dataView = new DataView(arrayBuffer);

      // Read as 32-bit floats (assuming PCM format)
      // Note: In production, proper audio decoding would be needed
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = dataView.getFloat32(i * 4, true);
      }

      // Run transcription
      const result = await this.pipeline(audioData, {
        language: 'en',
        task: 'transcribe',
      });

      return {
        text: result.text,
        confidence: 1.0, // transformers.js doesn't provide confidence
        language: 'en',
      };
    } catch (error) {
      throw new Error(`Transcription failed: ${error}`);
    }
  }

  /**
   * Clean up resources and destroy the adapter.
   */
  async destroy(): Promise<void> {
    this.pipeline = null;
    this.isInitialized = false;
  }

  /**
   * Check if adapter is initialized.
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
