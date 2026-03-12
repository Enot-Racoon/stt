/**
 * Represents the possible states of the speech engine state machine.
 */
export type SpeechState =
  | 'idle'
  | 'initializing'
  | 'downloading'
  | 'ready'
  | 'recording'
  | 'processing'
  | 'error';
