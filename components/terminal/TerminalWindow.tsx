"use client";
import { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "warning" | "error" | "success";
}

const borderColors = {
  default: "border-terminal-border",
  warning: "border-terminal-amber",
  error: "border-terminal-red",
  success: "border-terminal-green",
};

export function TerminalWindow({ title, children, className = "", variant = "default" }: Props) {
  return (
    <div className={`border ${borderColors[variant]} bg-terminal-bg/80 backdrop-blur-sm ${className}`}>
      {title && (
        <div className={`border-b ${borderColors[variant]} px-4 py-2 flex items-center gap-2`}>
          <span className="text-terminal-dim text-xs">┌─</span>
          <span className="text-xs text-terminal-text uppercase tracking-wider">{title}</span>
          <span className="text-terminal-dim text-xs flex-1 overflow-hidden whitespace-nowrap">{"─".repeat(60)}</span>
          <span className="text-terminal-dim text-xs">─┐</span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
