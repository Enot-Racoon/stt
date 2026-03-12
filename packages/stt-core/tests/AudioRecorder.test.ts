import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { AudioRecorder } from '../src/audio/AudioRecorder';

// Mock MediaRecorder
class MockMediaRecorder {
  static isTypeSupported = mock((type: string) => true);

  mimeType = 'audio/webm';
  state = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions
  ) {}

  start(_timeslice?: number): void {
    this.state = 'recording';
    // Simulate data available event
    setTimeout(() => {
      if (this.ondataavailable) {
        const blob = new Blob(['audio data'], { type: this.mimeType });
        this.ondataavailable({ data: blob } as BlobEvent);
      }
    }, 10);
  }

  stop(): void {
    this.state = 'inactive';
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 10);
  }
}

// Mock navigator.mediaDevices
const mockStream = {
  getTracks: () => [
    {
      stop: mock(() => {}),
    },
  ],
} as MediaStream;

const originalMediaRecorder = global.MediaRecorder;
const originalNavigator = global.navigator;

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    // @ts-ignore - Mock MediaRecorder
    global.MediaRecorder = MockMediaRecorder;

    // @ts-ignore - Mock navigator
    global.navigator = {
      mediaDevices: {
        getUserMedia: mock(async () => mockStream),
      },
    };

    recorder = new AudioRecorder();
  });

  afterEach(() => {
    global.MediaRecorder = originalMediaRecorder;
    global.navigator = originalNavigator;
  });

  test('start() requests microphone', async () => {
    const getUserMediaSpy = mock(async () => mockStream);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia = getUserMediaSpy;

    await recorder.start();

    expect(getUserMediaSpy).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });
  });

  test('recording collects chunks', async () => {
    await recorder.start();
    expect(recorder.isRecordingAudio()).toBe(true);

    // Wait for data to be collected
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  test('stop() returns Blob', async () => {
    await recorder.start();

    // Wait a bit for recording to start
    await new Promise((resolve) => setTimeout(resolve, 20));

    const blob = await recorder.stop();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('audio');
    expect(recorder.isRecordingAudio()).toBe(false);
  });

  test('cancel() stops recording', async () => {
    await recorder.start();
    expect(recorder.isRecordingAudio()).toBe(true);

    recorder.cancel();

    expect(recorder.isRecordingAudio()).toBe(false);
  });

  test('start() does nothing if already recording', async () => {
    const getUserMediaSpy = mock(async () => mockStream);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia = getUserMediaSpy;

    await recorder.start();
    const firstCallCount = getUserMediaSpy.mock.calls.length;

    await recorder.start();
    const secondCallCount = getUserMediaSpy.mock.calls.length;

    expect(firstCallCount).toBe(secondCallCount);
  });

  test('stop() throws error if not recording', async () => {
    await expect(recorder.stop()).rejects.toThrow('Not recording');
  });

  test('getStream() returns stream after start', async () => {
    await recorder.start();
    expect(recorder.getStream()).toBe(mockStream);
  });

  test('onData callback is called with chunks', async () => {
    const onDataSpy = mock((chunk: Blob) => {
      // Handler logic
    });

    recorder = new AudioRecorder({ onData: onDataSpy });

    await recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onDataSpy).toHaveBeenCalled();
  });

  test('custom mimeType option is used', async () => {
    recorder = new AudioRecorder({ mimeType: 'audio/ogg' });
    await recorder.start();

    // Should not throw
    expect(recorder.isRecordingAudio()).toBe(true);

    recorder.cancel();
  });
});
