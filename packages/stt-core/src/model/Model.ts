// TODO: Implement speech recognition model interface
export interface SpeechModel {
  name: string;
  load(): Promise<void>;
  recognize(audio: Float32Array): Promise<string>;
}
