// TODO: Implement SpeechButton component
import { type ButtonHTMLAttributes } from "react";

export interface SpeechButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isListening?: boolean;
  onToggle?: (isListening: boolean) => void;
}

export function SpeechButton({
  isListening = false,
  onToggle,
  ...props
}: SpeechButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isListening}
      onClick={() => onToggle?.(!isListening)}
      {...props}
    >
      {isListening ? "Stop Listening" : "Start Listening"}
    </button>
  );
}
