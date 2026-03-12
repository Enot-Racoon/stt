// TODO: Implement SpeechTextarea component
import { type TextareaHTMLAttributes } from "react";

export interface SpeechTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  isListening?: boolean;
  transcript?: string;
  onTranscriptChange?: (transcript: string) => void;
}

export function SpeechTextarea({
  isListening = false,
  transcript = "",
  onTranscriptChange,
  ...props
}: SpeechTextareaProps) {
  return (
    <div>
      <textarea
        value={transcript}
        onChange={(e) => onTranscriptChange?.(e.target.value)}
        placeholder="Speech will appear here..."
        aria-live="polite"
        {...props}
      />
      {isListening && <span>Listening...</span>}
    </div>
  );
}
