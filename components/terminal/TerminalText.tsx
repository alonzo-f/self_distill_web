"use client";
import { useState, useEffect } from "react";

interface Props {
  text: string;
  speed?: number; // ms per character
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
  delay?: number; // initial delay
}

export function TerminalText({ text, speed = 30, className = "", onComplete, showCursor = true, delay = 0 }: Props) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);
  const isComplete = started && displayedText.length >= text.length;

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayedText.length >= text.length) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, displayedText.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedText, text, speed, started, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && !isComplete && <span className="animate-pulse">█</span>}
    </span>
  );
}
