/**
 * Options for configuring the SilenceDetector.
 */
export interface SilenceDetectorOptions {
  /**
   * Volume threshold for detecting silence (0.0 to 1.0).
   * Lower values mean more sensitive silence detection.
   * @default 0.01
   */
  threshold?: number;

  /**
   * Time in milliseconds of continuous silence before triggering callback.
   * @default 2000
   */
  silenceTime?: number;

  /**
   * Interval in milliseconds for checking audio levels.
   * @default 100
   */
  checkInterval?: number;
}

/**
 * SilenceDetector monitors audio stream for silence.
 *
 * Uses the WebAudio API with an AnalyserNode to monitor
 * audio levels and detect when silence occurs.
 */
export class SilenceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private silenceStartTime: number | null = null;

  private threshold: number;
  private silenceTime: number;
  private checkInterval: number;

  /**
   * Creates a new SilenceDetector instance.
   * @param options - Configuration options for silence detection
   */
  constructor(options: SilenceDetectorOptions = {}) {
    this.threshold = options.threshold ?? 0.01;
    this.silenceTime = options.silenceTime ?? 2000;
    this.checkInterval = options.checkInterval ?? 100;
  }

  /**
   * Start monitoring a stream for silence.
   * @param stream - The MediaStream to monitor
   * @param onSilence - Callback triggered when silence is detected
   */
  start(stream: MediaStream, onSilence: () => void): void {
    if (this.isRunning) {
      return;
    }

    try {
      // Create audio context
      this.audioContext = new AudioContext();

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      // Connect stream to analyser
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      this.isRunning = true;
      this.silenceStartTime = null;

      // Start monitoring loop
      this.monitorLoop(onSilence);
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start silence detection: ${error}`);
    }
  }

  /**
   * Stop monitoring for silence.
   */
  stop(): void {
    this.isRunning = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.cleanup();
  }

  /**
   * Check if currently monitoring.
   */
  isDetecting(): boolean {
    return this.isRunning;
  }

  /**
   * Get current volume level (0.0 to 1.0).
   */
  getCurrentVolume(): number {
    if (!this.analyser) {
      return 0;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const average = sum / dataArray.length;

    // Normalize to 0-1 range
    return average / 255;
  }

  /**
   * Monitoring loop that checks audio levels.
   */
  private monitorLoop(onSilence: () => void): void {
    if (!this.isRunning) {
      return;
    }

    const volume = this.getCurrentVolume();
    const isSilent = volume < this.threshold;

    if (isSilent) {
      // Start or continue silence timer
      if (this.silenceStartTime === null) {
        this.silenceStartTime = Date.now();
      }

      const silenceDuration = Date.now() - this.silenceStartTime;

      if (silenceDuration >= this.silenceTime) {
        // Silence threshold reached
        onSilence();
        this.silenceStartTime = null; // Reset for next detection
      }
    } else {
      // Sound detected, reset silence timer
      this.silenceStartTime = null;
    }

    // Schedule next check
    this.silenceTimer = setTimeout(() => {
      this.monitorLoop(onSilence);
    }, this.checkInterval);
  }

  /**
   * Clean up resources.
   */
  private cleanup(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.silenceStartTime = null;
  }
}
