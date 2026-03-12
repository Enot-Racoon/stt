// TODO: Define core types for speech recognition

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionEvent {
  type: "start" | "end" | "result" | "error";
  data?: SpeechRecognitionResult | Error;
}

export type SpeechRecognitionListener = (event: SpeechRecognitionEvent) => void;

export interface SpeechConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}
