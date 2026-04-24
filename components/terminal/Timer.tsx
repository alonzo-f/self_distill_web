"use client";
import { useState, useEffect } from "react";

interface Props {
  seconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  className?: string;
}

export function Timer({ seconds, onComplete, autoStart = true, className = "" }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);

  useEffect(() => {
    if (!running || remaining <= 0) return;

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running, remaining, onComplete]);

  const isUrgent = remaining <= 10;

  return (
    <span className={`font-mono text-sm ${isUrgent ? "text-terminal-red animate-pulse" : "text-terminal-amber"} ${className}`}>
      [{remaining}s remaining]
    </span>
  );
}
