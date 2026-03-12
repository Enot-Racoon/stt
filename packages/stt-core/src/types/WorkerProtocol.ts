import { SpeechOptions } from './SpeechOptions';
import { SpeechResult } from './SpeechResult';

/**
 * Request message types for worker communication.
 */
export type WorkerRequest =
  | { type: 'INIT_MODEL'; payload: SpeechOptions }
  | { type: 'TRANSCRIBE'; payload: Blob }
  | { type: 'DESTROY' };

/**
 * Response message types from worker.
 */
export type WorkerResponse =
  | { type: 'MODEL_READY'; payload: { success: boolean } }
  | { type: 'RESULT'; payload: SpeechResult }
  | { type: 'ERROR'; payload: { message: string; code?: string } };

/**
 * Generic message type for worker transport.
 */
export type WorkerMessage = WorkerRequest | WorkerResponse;
