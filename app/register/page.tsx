"use client";

// v4 registration page — camera + nickname + grouped consent.
// Reference: docs/v4-migration-plan.md Phase 1; project_v4 III. 阶段 1
//
// v4 调整 (2026-05-22): 简化表单
//   - 移除 email 输入 + email consent (现场观众不需要长尾邮件)
//   - 移除 phone last4 输入 (跨设备重入暂时不做)
//   - 两个 consent (GDPR 公开照片 / Optimization Terms) 合并到一个组,
//     共享一个"AGREEMENTS"区块, 视觉更整洁

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  TerminalWindow,
  SystemMessage,
  TerminalText,
} from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { TERMS_OF_SERVICE } from "@/lib/data/terms-of-service";
import {
  loadSession,
  saveSession,
  createSession,
  advancePhase,
} from "@/lib/local-storage";
import { PHASE_TO_ROUTE } from "@/lib/state-machine";

const NICKNAME_RE = /^[\w\s@.一-龥-]{3,20}$/;

type Step = "form" | "submitting" | "done";

export default function RegisterPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [step, setStep] = useState<Step>("form");

  // Form state
  const [nickname, setNickname] = useState("");
  // v4 (2026-05-22, 修改0519.md item 1): consents start pre-checked. The
  // dark-pattern auto-check for termsAgreed at 1.2s still runs, but defaults
  // align both boxes to true so the form submits cleanly once a name +
  // photo are provided.
  const [gdprAgreed, setGdprAgreed] = useState(true);
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [displayId] = useState(
    () => `HUMAN_${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`,
  );

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);

  // Gate. Self-heals: any user who reached /register has effectively passed PSA.
  useEffect(() => {
    console.info("[/register] mount; checking session");
    const persisted = loadSession();
    if (!persisted || persisted.phase === "UNREGISTERED") {
      const base =
        persisted ??
        createSession({
          userId: crypto.randomUUID(),
          displayId: "",
          displayName: "",
          phoneLast4: null,
        });
      saveSession(advancePhase(base, "PSA_VIEWED"));
      return;
    }
    if (persisted.phase !== "PSA_VIEWED") {
      router.replace(PHASE_TO_ROUTE[persisted.phase]);
      return;
    }
  }, [router]);

  // -------- Camera --------
  useEffect(() => {
    if (photoDataUrl) return; // camera no longer needed
    let stream: MediaStream | null = null;
    let cancelled = false;

    const launch = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCameraError("Camera API not available. Please use HTTPS.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraError(null);
          setCameraReady(true);
        }
      } catch (err) {
        console.error("Camera denied", err);
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(
          msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Camera permission denied."
            : `Camera unavailable: ${msg}`,
        );
        setCameraReady(false);
      }
    };

    void launch();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setCameraReady(false);
    };
  }, [photoDataUrl]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    if (videoRef.current.srcObject) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    }
    const dataUrl = videoRef.current.srcObject
      ? canvasRef.current.toDataURL("image/jpeg", 0.8)
      : null;
    setPhotoDataUrl(dataUrl);

    const tracks = (videoRef.current.srcObject as MediaStream)?.getTracks();
    tracks?.forEach((t) => t.stop());
  }, []);

  // -------- Dark-pattern terms scroll --------
  useEffect(() => {
    if (!termsRef.current) return;
    const el = termsRef.current;
    const t = setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 300);
    const auto = setTimeout(() => setTermsAgreed(true), 1200);
    return () => {
      clearTimeout(t);
      clearTimeout(auto);
    };
  }, []);

  // -------- Validation --------
  const nicknameValid = NICKNAME_RE.test(nickname.trim());
  const canSubmit =
    nicknameValid &&
    photoDataUrl !== null &&
    gdprAgreed &&
    termsAgreed &&
    step === "form";

  // -------- Submit --------
  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setStep("submitting");

    const userId = crypto.randomUUID();
    const persistedExisting = loadSession();
    const session = advancePhase(
      createSession({
        userId,
        displayId,
        displayName: nickname.trim(),
        phoneLast4: null,
      }),
      "REGISTERED",
    );
    saveSession({ ...session, createdAt: persistedExisting?.createdAt ?? Date.now() });

    store.setParticipant({
      id: userId,
      displayId,
      displayName: nickname.trim(),
      phoneLast4: null,
      photoUrl: photoDataUrl,
      phase: "REGISTERED",
      status: "UNPROCESSED",
    });

    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          displayId,
          displayName: nickname.trim(),
          phase: "REGISTERED",
          photoUrl: photoDataUrl,
          status: "UNPROCESSED",
          output: 0,
          isOperator: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.participant?.photoUrl) {
          store.setParticipant({ photoUrl: data.participant.photoUrl });
        }
      }
    } catch {
      // Local fallback — proceed even if API failed.
    }

    setStep("done");
  }, [canSubmit, displayId, nickname, photoDataUrl, store]);

  // -------- Render: completion screen --------
  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
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
                Profile created: {displayId} — @{nickname.trim()}
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
        </div>
      </div>
    );
  }

  // -------- Render: form --------
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <TerminalWindow title="BIOMETRIC REGISTRATION">
          <div className="space-y-4">
            <SystemMessage type="system">
              Welcome to the Expression Optimization Service.
            </SystemMessage>

            {/* ───── Camera ───── */}
            <div className="space-y-2">
              <div className="text-terminal-dim text-[10px] tracking-widest">
                ☐ FRONT-CAMERA PHOTO
              </div>
              <div className="relative aspect-[4/3] bg-black border border-terminal-border overflow-hidden">
                {!photoDataUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                        <p className="text-terminal-red text-xs text-center">
                          {cameraError}
                        </p>
                      </div>
                    )}
                    {!cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border border-terminal-green/30 rounded-full" />
                      </div>
                    )}
                  </>
                ) : (
                  <Image
                    src={photoDataUrl}
                    alt="captured"
                    fill
                    unoptimized
                    className="object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {!photoDataUrl ? (
                <button
                  onClick={capturePhoto}
                  disabled={!!cameraError && !cameraReady}
                  className={`w-full border px-4 py-2 text-xs transition-colors ${
                    cameraError
                      ? "border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10"
                      : "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                  }`}
                >
                  ▣ {cameraError ? "Continue Without Photo" : "Capture Biometric Data"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setPhotoDataUrl(null);
                    setCameraError(null);
                  }}
                  className="w-full border border-terminal-dim text-terminal-dim px-4 py-2 text-xs hover:bg-terminal-dim/10 transition-colors"
                >
                  ↻ Retake photo
                </button>
              )}
            </div>

            {/* ───── Nickname ─────
                v4 (2026-05-22, 修改0519.md item 4): bumped to a fully
                highlighted, larger input so the field is unmissable.
                Box, label, and placeholder are all heavier than the
                surrounding rows. */}
            <div className="space-y-2 border-2 border-terminal-green/60 bg-terminal-green/5 p-3">
              <label className="text-terminal-green text-xs tracking-widest font-bold block">
                ▸ DISPLAY NAME
                <span className="text-terminal-dim text-[10px] font-normal ml-2">
                  (3-20 chars)
                </span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="Type your name here"
                className="w-full bg-black border-2 border-terminal-green/50 text-terminal-green px-4 py-3 text-lg font-mono focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim/50 placeholder:text-base placeholder:italic"
              />
              {nickname.length > 0 && !nicknameValid && (
                <div className="text-terminal-red text-xs">
                  3-20 characters, letters/numbers/spaces/CJK only
                </div>
              )}
            </div>

            {/* ───── Optimization Terms scroll (dark pattern) ───── */}
            <div className="space-y-1">
              <div className="text-terminal-dim text-[10px] tracking-widest">
                ☐ OPTIMIZATION TERMS
              </div>
              <div
                ref={termsRef}
                className="h-20 overflow-y-auto text-terminal-dim text-[9px] leading-relaxed border border-terminal-border p-2 scroll-smooth"
              >
                <pre className="whitespace-pre-wrap font-mono">{TERMS_OF_SERVICE}</pre>
              </div>
              <div className="text-terminal-dim text-[9px] italic">
                [scrolled past in 0.3 seconds]
              </div>
            </div>

            {/* ───── Grouped consents ───── */}
            <div className="space-y-2 border border-terminal-border/60 p-3 bg-terminal-bg/40">
              <div className="text-terminal-dim text-[10px] tracking-widest mb-1">
                ☐ AGREEMENTS
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gdprAgreed}
                  onChange={(e) => setGdprAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-terminal-green flex-shrink-0"
                />
                <span className="text-[11px] text-terminal-text leading-snug">
                  I consent to public display of my photo on the projection wall
                  during this session.
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-terminal-green flex-shrink-0"
                />
                <span className="text-[11px] text-terminal-text leading-snug">
                  I agree to the Expression Optimization Terms.
                </span>
              </label>
            </div>

            {/* ───── Submit ───── */}
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`w-full border px-4 py-3 text-sm transition-colors ${
                canSubmit
                  ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                  : "border-terminal-border text-terminal-dim cursor-not-allowed"
              }`}
            >
              {step === "submitting" ? "Processing..." : "Continue →"}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
