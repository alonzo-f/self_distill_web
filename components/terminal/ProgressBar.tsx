"use client";

interface Props {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercent?: boolean;
  color?: "green" | "amber" | "red" | "text";
  className?: string;
}

const colorMap = {
  green: "text-terminal-green",
  amber: "text-terminal-amber",
  red: "text-terminal-red",
  text: "text-terminal-text",
};

export function ProgressBar({ value, max = 100, label, showPercent = true, color = "green", className = "" }: Props) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const filled = Math.round(percent / 5); // 20 chars total
  const empty = 20 - filled;

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${className}`}>
      {label && <span className="text-terminal-dim min-w-[120px]">{label}:</span>}
      <span className={colorMap[color]}>
        {"█".repeat(filled)}
        <span className="text-terminal-dim">{"░".repeat(empty)}</span>
      </span>
      {showPercent && <span className="text-terminal-dim ml-1">{Math.round(percent)}%</span>}
    </div>
  );
}
