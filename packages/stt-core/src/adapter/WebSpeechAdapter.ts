// TODO: Implement Web Speech API adapter
import { SpeechAdapter } from "./Adapter";

export class WebSpeechAdapter implements SpeechAdapter {
  name = "WebSpeechAPI";

  async initialize(): Promise<void> {
    throw new Error("Not implemented");
  }

  async startListening(): Promise<void> {
    throw new Error("Not implemented");
  }

  async stopListening(): Promise<void> {
    throw new Error("Not implemented");
  }

  isListening(): boolean {
    return false;
  }
}
