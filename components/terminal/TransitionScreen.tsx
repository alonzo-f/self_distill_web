"use client";
import { useEffect, useState } from "react";
import { TerminalText } from "./TerminalText";

interface Props {
  messages: string[];
  onComplete?: () => void;
  duration?: number; // total duration in ms
}

export function TransitionScreen({ messages, onComplete, duration = 3000 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= messages.length) {
      const timer = setTimeout(() => onComplete?.(), 500);
      return () => clearTimeout(timer);
    }
    const interval = duration / messages.length;
    const timer = setTimeout(() => setCurrentIndex((i) => i + 1), interval);
    return () => clearTimeout(timer);
  }, [currentIndex, messages.length, duration, onComplete]);

  return (
    <div className="fixed inset-0 bg-terminal-bg z-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-2">
        {messages.slice(0, currentIndex + 1).map((msg, i) => (
          <div key={i} className="text-terminal-green text-sm">
            <TerminalText text={`> ${msg}`} speed={15} showCursor={i === currentIndex && currentIndex < messages.length} />
          </div>
        ))}
        {currentIndex < messages.length && (
          <div className="mt-4 text-terminal-dim text-xs animate-pulse">
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
