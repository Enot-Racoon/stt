// React example - TODO: Implement full React example
import { useSpeechToText } from "stt-react";
import { SpeechButton, SpeechTextarea } from "stt-ui";

// This is a placeholder example
// Full implementation coming soon

export function SpeechDemo() {
  const { isListening, transcript, startListening, stopListening } =
    useSpeechToText();

  return (
    <div>
      <h1>Speech-to-Text Demo</h1>
      <SpeechButton
        isListening={isListening}
        onToggle={(listening) => (listening ? startListening() : stopListening())}
      />
      <SpeechTextarea transcript={transcript} />
    </div>
  );
}
