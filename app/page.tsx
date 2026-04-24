"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TerminalWindow, TerminalText, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { TERMS_OF_SERVICE } from "@/lib/data/terms-of-service";

type Phase = "welcome" | "terms" | "photo" | "registered";

export default function LandingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [agreed, setAgreed] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [displayId] = useState(() =>
    `HUMAN_${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);
  const store = useParticipantStore();

  // Auto-scroll terms
  useEffect(() => {
    if (phase !== "terms" || !termsRef.current) return;
    const el = termsRef.current;
    const timer = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 300);
    return () => clearTimeout(timer);
  }, [phase]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  }, []);

  useEffect(() => {
    if (phase === "photo") {
      startCamera();
    }
    const video = videoRef.current;
    return () => {
      if (video?.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, [phase, startCamera]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
    setPhotoDataUrl(dataUrl);

    // Stop camera
    const tracks = (videoRef.current.srcObject as MediaStream)?.getTracks();
    tracks?.forEach((t) => t.stop());

    // Store in zustand
    const id = crypto.randomUUID();
    store.setParticipant({
      id,
      displayId,
      photoUrl: dataUrl,
      status: "UNPROCESSED",
    });

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          displayId,
          photoUrl: dataUrl,
          status: "UNPROCESSED",
          output: 0,
          isOperator: false,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.participant?.photoUrl) {
          store.setParticipant({ photoUrl: data.participant.photoUrl });
        }
      }
    } catch {
      // Registration remains usable in local fallback mode.
    }

    setTimeout(() => setPhase("registered"), 500);
  }, [displayId, store]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* WELCOME */}
        {phase === "welcome" && (
          <TerminalWindow title="SYSTEM INIT">
            <div className="space-y-4">
              <SystemMessage type="system">
                Welcome to the Expression Optimization Service.
              </SystemMessage>
              <SystemMessage type="info">
                We help you communicate more effectively.
              </SystemMessage>
              <div className="mt-6 text-terminal-dim text-xs space-y-2">
                <p>{">"} To personalize your experience, we need a few things:</p>
                <p className="ml-4">☐ A photo for your profile (front camera required)</p>
                <p className="ml-4">☐ Permission to analyze your input patterns</p>
                <p className="ml-4">☐ Agreement to our Optimization Terms</p>
              </div>
              <button
                onClick={() => setPhase("terms")}
                className="mt-6 w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                Continue →
              </button>
            </div>
          </TerminalWindow>
        )}

        {/* TERMS OF SERVICE — Dark Pattern: auto-scroll */}
        {phase === "terms" && (
          <TerminalWindow title="OPTIMIZATION TERMS">
            <div className="space-y-4">
              <div
                ref={termsRef}
                className="h-48 overflow-y-auto text-terminal-dim text-[10px] leading-relaxed border border-terminal-border p-3 scroll-smooth"
              >
                <pre className="whitespace-pre-wrap font-mono">
                  {TERMS_OF_SERVICE}
                </pre>
              </div>
              <div className="text-terminal-dim text-[10px] italic">
                [scrolled past in 0.3 seconds]
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 accent-terminal-green"
                />
                <span className="text-xs text-terminal-text group-hover:text-terminal-green transition-colors">
                  I agree to the Expression Optimization Terms
                </span>
              </label>
              <button
                onClick={() => agreed && setPhase("photo")}
                disabled={!agreed}
                className={`w-full border px-4 py-3 text-sm transition-colors ${
                  agreed
                    ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                    : "border-terminal-border text-terminal-dim cursor-not-allowed"
                }`}
              >
                Proceed to photo registration ▶
              </button>
            </div>
          </TerminalWindow>
        )}

        {/* PHOTO CAPTURE */}
        {phase === "photo" && (
          <TerminalWindow title="BIOMETRIC REGISTRATION">
            <div className="space-y-4">
              <SystemMessage type="system">
                Front camera active. Position your face in frame.
              </SystemMessage>
              <div className="relative aspect-[4/3] bg-black border border-terminal-border overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {/* Crosshair overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border border-terminal-green/30 rounded-full" />
                  <div className="absolute w-1 h-8 bg-terminal-green/30" />
                  <div className="absolute w-8 h-1 bg-terminal-green/30" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={capturePhoto}
                className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                ▣ Capture Biometric Data
              </button>
            </div>
          </TerminalWindow>
        )}

        {/* REGISTERED */}
        {phase === "registered" && (
          <TerminalWindow title="REGISTRATION COMPLETE">
            <div className="space-y-3">
              {photoDataUrl && (
                <div className="w-24 h-24 mx-auto border border-terminal-green overflow-hidden">
                  <Image
                    src={photoDataUrl}
                    alt="profile"
                    width={96}
                    height={96}
                    unoptimized
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
              )}
              <SystemMessage type="system">Biometric ID registered.</SystemMessage>
              <SystemMessage type="info">
                Profile created: {displayId}
              </SystemMessage>
              <SystemMessage type="info">Status: UNPROCESSED</SystemMessage>
              <div className="mt-2 space-y-1">
                <TerminalText
                  text="> loading: retrieving your optimization history..."
                  speed={20}
                  className="text-terminal-dim text-xs block"
                />
                <TerminalText
                  text="> note: no prior record found — initializing new profile"
                  speed={20}
                  delay={1500}
                  className="text-terminal-dim text-xs block"
                />
              </div>
              <button
                onClick={() => router.push("/calibrate")}
                className="mt-6 w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                Begin Calibration →
              </button>
            </div>
          </TerminalWindow>
        )}
      </div>
    </div>
  );
}
