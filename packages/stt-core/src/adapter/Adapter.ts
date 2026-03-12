// TODO: Implement adapter interface for different speech recognition backends
export interface SpeechAdapter {
  name: string;
  initialize(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): boolean;
}
