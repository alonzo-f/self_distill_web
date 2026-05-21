import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DebugBar } from "@/components/DebugBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expression Optimization Service",
  description: "We help you communicate more effectively.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        suppressHydrationWarning: needed because browser extensions
        (e.g. mpa analytics, dark-reader, language tools) inject
        attributes on <body> *before* React hydrates. Only the body's
        own attributes are silenced — children remain fully diffed.
      */}
      <body
        suppressHydrationWarning
        className="min-h-full bg-terminal-bg text-terminal-text font-mono scanline-overlay"
      >
        <DebugBar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
