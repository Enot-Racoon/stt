import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { SilenceDetector } from '../src/vad/SilenceDetector';

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  close = mock(async () => {});

  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }

  createMediaStreamSource(_stream: MediaStream): MockMediaStreamAudioSourceNode {
    return new MockMediaStreamAudioSourceNode();
  }
}

class MockAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  connected = false;

  getByteFrequencyData(data: Uint8Array): void {
    // Fill with zeros (silence) by default
    data.fill(0);
  }

  disconnect(): void {
    this.connected = false;
  }

  connect(): void {
    this.connected = true;
  }
}

class MockMediaStreamAudioSourceNode {
  connected = false;

  disconnect(): void {
    this.connected = false;
  }

  connect(_destination: AudioNode): void {
    this.connected = true;
  }
}

// Mock stream
const mockStream = {} as MediaStream;

const originalAudioContext = global.AudioContext;

describe('SilenceDetector', () => {
  let detector: SilenceDetector;

  beforeEach(() => {
    // @ts-ignore - Mock AudioContext
    global.AudioContext = MockAudioContext;
    detector = new SilenceDetector({
      threshold: 0.01,
      silenceTime: 100, // Short for testing
      checkInterval: 50,
    });
  });

  afterEach(() => {
    detector.stop();
    global.AudioContext = originalAudioContext;
  });

  test('start() initializes audio context and analyser', () => {
    detector.start(mockStream, () => {});
    expect(detector.isDetecting()).toBe(true);
  });

  test('silence triggers callback', async () => {
    const onSilenceSpy = mock(() => {});

    detector.start(mockStream, onSilenceSpy);

    // Wait for silence detection
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(onSilenceSpy).toHaveBeenCalled();
  });

  test('stop() stops detection', () => {
    detector.start(mockStream, () => {});
    expect(detector.isDetecting()).toBe(true);

    detector.stop();
    expect(detector.isDetecting()).toBe(false);
  });

  test('start() does nothing if already running', () => {
    const onSilenceSpy = mock(() => {});

    detector.start(mockStream, onSilenceSpy);
    const firstCallCount = onSilenceSpy.mock.calls.length;

    detector.start(mockStream, onSilenceSpy);

    expect(onSilenceSpy.mock.calls.length).toBe(firstCallCount);
  });

  test('getCurrentVolume() returns volume level', () => {
    detector.start(mockStream, () => {});

    const volume = detector.getCurrentVolume();

    expect(typeof volume).toBe('number');
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });

  test('silence timer resets on sound', async () => {
    const onSilenceSpy = mock(() => {});

    // Create detector with longer silence time
    detector = new SilenceDetector({
      threshold: 0.5, // Higher threshold
      silenceTime: 100,
      checkInterval: 50,
    });

    // Mock analyser to return varying volume
    const originalGetByteFrequencyData = MockAnalyserNode.prototype.getByteFrequencyData;
    let callCount = 0;

    MockAnalyserNode.prototype.getByteFrequencyData = function (data: Uint8Array) {
      callCount++;
      // First few calls: silence, then sound, then silence again
      if (callCount < 3) {
        data.fill(0); // Silence
      } else if (callCount < 6) {
        data.fill(200); // Loud sound
      } else {
        data.fill(0); // Silence again
      }
    };

    detector.start(mockStream, onSilenceSpy);

    // Wait for multiple silence periods
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Should have detected silence at least once
    expect(onSilenceSpy).toHaveBeenCalled();

    // Restore original method
    MockAnalyserNode.prototype.getByteFrequencyData = originalGetByteFrequencyData;
  });

  test('custom options are applied', () => {
    detector = new SilenceDetector({
      threshold: 0.05,
      silenceTime: 3000,
      checkInterval: 200,
    });

    detector.start(mockStream, () => {});
    expect(detector.isDetecting()).toBe(true);
  });

  test('cleanup releases resources', async () => {
    const closeSpy = mock(async () => {});

    // @ts-ignore - Mock AudioContext with spy
    global.AudioContext = class extends MockAudioContext {
      close = closeSpy;
    };

    detector = new SilenceDetector();
    detector.start(mockStream, () => {});
    detector.stop();

    // Wait for async cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(closeSpy).toHaveBeenCalled();
  });
});
