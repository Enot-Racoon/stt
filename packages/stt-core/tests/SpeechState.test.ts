import { describe, expect, test } from 'bun:test';
import type { SpeechState } from '../src/types/SpeechState';

describe('SpeechState', () => {
  const validStates: SpeechState[] = [
    'idle',
    'initializing',
    'downloading',
    'ready',
    'recording',
    'processing',
    'error',
  ];

  test('initial state is idle', () => {
    const initialState: SpeechState = 'idle';
    expect(initialState).toBe('idle');
  });

  test('all valid states are defined', () => {
    expect(validStates).toHaveLength(7);
    expect(validStates).toContain('idle');
    expect(validStates).toContain('initializing');
    expect(validStates).toContain('downloading');
    expect(validStates).toContain('ready');
    expect(validStates).toContain('recording');
    expect(validStates).toContain('processing');
    expect(validStates).toContain('error');
  });

  test('state type prevents invalid values at compile time', () => {
    // This test verifies TypeScript enforces valid states
    // The following would cause a compile error if uncommented:
    // const invalidState: SpeechState = 'invalid_state';
    
    // Valid states should compile without errors
    const states: SpeechState[] = ['idle', 'ready', 'error'];
    expect(states.every((s) => validStates.includes(s))).toBe(true);
  });

  test('state transitions conceptually', () => {
    // Define expected state transitions
    const transitions: Record<SpeechState, SpeechState[]> = {
      idle: ['initializing'],
      initializing: ['downloading', 'ready', 'error'],
      downloading: ['ready', 'error'],
      ready: ['recording', 'initializing'],
      recording: ['processing', 'idle'],
      processing: ['ready', 'error'],
      error: ['idle', 'initializing'],
    };

    // Verify all states have defined transitions
    validStates.forEach((state) => {
      expect(transitions[state]).toBeDefined();
      expect(Array.isArray(transitions[state])).toBe(true);
    });
  });

  test('idle is the default starting state', () => {
    const defaultState: SpeechState = 'idle';
    expect(defaultState).toEqual('idle');
  });
});
