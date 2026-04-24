"use client";

interface Props {
  text: string;
  className?: string;
  active?: boolean;
}

export function GlitchText({ text, className = "", active = true }: Props) {
  if (!active) return <span className={className}>{text}</span>;
  return (
    <span className={`glitch ${className}`} data-text={text}>
      {text}
    </span>
  );
}
