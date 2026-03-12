import type { WorkerRequest, WorkerResponse } from '../types/WorkerProtocol';
import type { SpeechAdapter } from '../adapter/SpeechAdapter';

/**
 * Speech worker for handling speech recognition tasks.
 *
 * This worker runs in a separate thread and handles:
 * - Model initialization using transformers.js
 * - Audio transcription using Whisper
 * - Cleanup
 *
 * Communication uses the WorkerProtocol message format.
 */

/**
 * Single adapter instance for the worker.
 * Reused across multiple transcription requests.
 */
let adapter: SpeechAdapter | null = null;

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'INIT_MODEL':
        await handleInitModel(message);
        break;

      case 'TRANSCRIBE':
        await handleTranscribe(message);
        break;

      case 'DESTROY':
        await handleDestroy();
        break;

      default:
        sendError(`Unknown message type: ${(message as { type: string }).type}`);
    }
  } catch (error) {
    sendError(error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Handle INIT_MODEL request.
 * Initializes the TransformersAdapter with the specified model.
 */
async function handleInitModel(message: { type: 'INIT_MODEL'; payload: unknown }): Promise<void> {
  if (adapter) {
    await adapter.destroy();
  }

  // Dynamically import the adapter to avoid bundling issues
  const { TransformersAdapter } = await import('../adapter/TransformersAdapter');
  adapter = new TransformersAdapter();

  const options = message.payload as { model?: 'whisper-tiny' | 'whisper-base'; language?: string };
  await adapter.init(options);

  const response: WorkerResponse = {
    type: 'MODEL_READY',
    payload: { success: true },
  };
  self.postMessage(response);
}

/**
 * Handle TRANSCRIBE request.
 * Transcribes audio data using the initialized adapter.
 */
async function handleTranscribe(message: { type: 'TRANSCRIBE'; payload: Blob }): Promise<void> {
  if (!adapter) {
    sendError('Adapter not initialized. Call INIT_MODEL first.');
    return;
  }

  try {
    const result = await adapter.transcribe(message.payload);

    const response: WorkerResponse = {
      type: 'RESULT',
      payload: result,
    };
    self.postMessage(response);
  } catch (error) {
    sendError(error instanceof Error ? error.message : 'Transcription failed');
  }
}

/**
 * Handle DESTROY request.
 * Cleans up resources and closes the worker.
 */
async function handleDestroy(): Promise<void> {
  if (adapter) {
    await adapter.destroy();
    adapter = null;
  }
  self.close();
}

/**
 * Send an error response to the main thread.
 * @param message - Error message
 * @param code - Optional error code
 */
function sendError(message: string, code?: string): void {
  const response: WorkerResponse = {
    type: 'ERROR',
    payload: { message, code },
  };
  self.postMessage(response);
}
