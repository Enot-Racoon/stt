import type { WorkerRequest, WorkerResponse } from '../types/WorkerProtocol';

/**
 * Speech worker for handling speech recognition tasks.
 *
 * This worker runs in a separate thread and handles:
 * - Model initialization
 * - Audio transcription
 * - Cleanup
 *
 * Communication uses the WorkerProtocol message format.
 */

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  switch (message.type) {
    case 'INIT_MODEL':
      handleInitModel(message);
      break;

    case 'TRANSCRIBE':
      handleTranscribe(message);
      break;

    case 'DESTROY':
      handleDestroy();
      break;

    default:
      sendError(`Unknown message type: ${(message as { type: string }).type}`);
  }
};

/**
 * Handle INIT_MODEL request.
 * Initializes the speech recognition model.
 */
function handleInitModel(_message: { type: 'INIT_MODEL'; payload: unknown }): void {
  // TODO: Implement actual model initialization
  // For now, respond with success immediately
  const response: WorkerResponse = {
    type: 'MODEL_READY',
    payload: { success: true },
  };
  self.postMessage(response);
}

/**
 * Handle TRANSCRIBE request.
 * Transcribes audio data to text.
 */
function handleTranscribe(_message: { type: 'TRANSCRIBE'; payload: Blob }): void {
  // TODO: Implement actual transcription
  // For now, return dummy transcription result
  const response: WorkerResponse = {
    type: 'RESULT',
    payload: {
      text: 'dummy transcription',
      confidence: 1.0,
      language: 'en',
    },
  };
  self.postMessage(response);
}

/**
 * Handle DESTROY request.
 * Cleans up resources and closes the worker.
 */
function handleDestroy(): void {
  // TODO: Implement cleanup if needed
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
