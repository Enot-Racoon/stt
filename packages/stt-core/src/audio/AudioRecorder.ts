/**
 * Options for configuring the AudioRecorder.
 */
export interface AudioRecorderOptions {
  /**
   * Audio MIME type for recording.
   * @default 'audio/webm'
   */
  mimeType?: string;

  /**
   * Audio bitrate in bits per second.
   */
  audioBitsPerSecond?: number;

  /**
   * Callback for receiving audio data chunks.
   */
  onData?: (chunk: Blob) => void;
}

/**
 * AudioRecorder handles microphone access and audio recording.
 *
 * Uses the MediaRecorder API to capture audio from the microphone
 * and collect it into chunks that can be combined into a final Blob.
 */
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private onDataCallback: ((chunk: Blob) => void) | null = null;
  private isRecording = false;

  /**
   * Creates a new AudioRecorder instance.
   * @param options - Configuration options for the recorder
   */
  constructor(private options: AudioRecorderOptions = {}) {
    this.onDataCallback = options.onData || null;
  }

  /**
   * Start recording audio.
   * Requests microphone access and initializes MediaRecorder.
   * @throws Error if microphone access is denied or not supported
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Create MediaRecorder with the stream
      const mimeType = this.getMimeType();
      const recorderOptions: MediaRecorderOptions = {};

      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      if (this.options.audioBitsPerSecond) {
        recorderOptions.audioBitsPerSecond = this.options.audioBitsPerSecond;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);

      // Reset chunks array
      this.chunks = [];

      // Set up data available handler
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          if (this.onDataCallback) {
            this.onDataCallback(event.data);
          }
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  /**
   * Stop recording and return the audio Blob.
   * @returns Promise resolving to the recorded audio Blob
   */
  async stop(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not recording. Call start() first.'));
        return;
      }

      // Set up stop handler
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        this.cleanup();
        resolve(blob);
      };

      // Set up error handler
      this.mediaRecorder.onerror = (event: Event) => {
        this.cleanup();
        reject(new Error(`Recording error: ${event}`));
      };

      // Stop the recorder
      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording without returning audio data.
   */
  cancel(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      return;
    }

    this.mediaRecorder.onstop = null;
    this.mediaRecorder.stop();
    this.cleanup();
  }

  /**
   * Check if currently recording.
   */
  isRecordingAudio(): boolean {
    return this.isRecording;
  }

  /**
   * Get the recorded stream (available after start()).
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Clean up resources.
   */
  private cleanup(): void {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Clear references
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder = null;
    }

    this.chunks = [];
    this.isRecording = false;
  }

  /**
   * Get a supported MIME type for recording.
   */
  private getMimeType(): string | undefined {
    const preferredTypes = [
      this.options.mimeType,
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ].filter(Boolean) as string[];

    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return undefined;
  }
}
