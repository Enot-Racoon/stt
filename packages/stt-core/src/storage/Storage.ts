// TODO: Implement storage for speech data and models
export class SpeechStorage {
  // TODO: Store model data
  async store(key: string, data: ArrayBuffer): Promise<void> {
    throw new Error("Not implemented");
  }

  // TODO: Retrieve stored data
  async retrieve(key: string): Promise<ArrayBuffer | null> {
    throw new Error("Not implemented");
  }

  // TODO: Clear storage
  async clear(): Promise<void> {
    throw new Error("Not implemented");
  }
}
