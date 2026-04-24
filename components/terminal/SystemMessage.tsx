"use client";

interface Props {
  children: React.ReactNode;
  type?: "info" | "warning" | "error" | "system";
  prefix?: string;
}

const typeStyles = {
  info: "text-terminal-text",
  warning: "text-terminal-amber",
  error: "text-terminal-red",
  system: "text-terminal-green",
};

const prefixes = {
  info: ">",
  warning: "⚠",
  error: "✕",
  system: "SYSTEM:",
};

export function SystemMessage({ children, type = "system", prefix }: Props) {
  return (
    <div className={`flex gap-2 ${typeStyles[type]} text-sm font-mono`}>
      <span className="shrink-0 opacity-70">{prefix || prefixes[type]}</span>
      <span>{children}</span>
    </div>
  );
}
