"use client";

// v4 registration page — camera + nickname + GDPR consent + dark-pattern ToS.
// Reference: docs/v4-migration-plan.md Phase 1; project_v4 III. 阶段 1
//
// Single page that consolidates what used to be split across welcome/terms/photo.
// All four fields must be completed before [Continue] enables.

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
  const [phoneLast4, setPhoneLast4] = useState("");
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [gdprAgreed, setGdprAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
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

  // Gate.
  //
  // v4 fix (2026-05-21): the previous version bounced back to "/" whenever
  // localStorage was empty or stuck at UNREGISTERED. This created an
  // infinite loop with the PSA player on browsers that block / silently
  // fail localStorage writes (private mode, some mobile browsers). Now we
  // SELF-HEAL: if the gate finds no session or UNREGISTERED, we just
  // advance it to PSA_VIEWED in place. The user clearly already reached
  // /register, so they've seen the PSA. Only redirect onward if the user
  // has already progressed past PSA.
  useEffect(() => {
    console.info("[/register] mount; checking session");
    const persisted = loadSession();
    if (!persisted || persisted.phase === "UNREGISTERED") {
      console.info("[/register] missing/UNREGISTERED session → self-heal to PSA_VIEWED");
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
      console.info(`[/register] phase=${persisted.phase} ahead of PSA_VIEWED → forwarding`);
      router.replace(PHASE_TO_ROUTE[persisted.phase]);
      return;
    }
    console.info("[/register] phase=PSA_VIEWED, rendering form");
  }, [router]);

  // -------- Camera --------
  // Side effect lives entirely inside the effect; getUserMedia is async so
  // setState calls happen after the synchronous effect body finishes, which
  // is what the react-hooks/set-state-in-effect rule actually polices.
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

    // Stop camera tracks
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
  const phoneValid = phoneLast4 === "" || /^[0-9]{4}$/.test(phoneLast4);
  const emailValid =
    email === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const wantsEmail = email.trim().length > 0;
  // If user wrote an email they must also tick the email-consent box
  const emailConsistent = !wantsEmail || (emailValid && emailConsent);
  const canSubmit =
    nicknameValid &&
    phoneValid &&
    emailConsistent &&
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
        phoneLast4: phoneLast4 || null,
      }),
      "REGISTERED",
    );
    saveSession({ ...session, createdAt: persistedExisting?.createdAt ?? Date.now() });

    store.setParticipant({
      id: userId,
      displayId,
      displayName: nickname.trim(),
      phoneLast4: phoneLast4 || null,
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

    // v4 Phase 12: enqueue the 5-message aftermath sequence if the user opted in.
    if (wantsEmail && emailConsent) {
      try {
        await fetch("/api/enqueue-aftermath", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: userId, email: email.trim() }),
        });
      } catch {
        /* non-fatal */
      }
    }

    setStep("done");
  }, [canSubmit, displayId, nickname, phoneLast4, photoDataUrl, store, email, emailConsent, wantsEmail]);

  // -------- Render --------
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <TerminalWindow title="BIOMETRIC REGISTRATION">
          <div className="space-y-4">
            <SystemMessage type="system">
              Welcome to the Expression Optimization Service.
            </SystemMessage>
            <SystemMessage type="info">
              We need the following to personalize your experience.
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

            {/* ───── Nickname ───── */}
            <div className="space-y-1">
              <label className="text-terminal-dim text-[10px] tracking-widest block">
                ☐ DISPLAY NAME (3-20 chars)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="Enter the name you want the system to remember you by"
                className="w-full bg-black border border-terminal-border text-terminal-text px-3 py-2 text-sm focus:outline-none focus:border-terminal-green"
              />
              {nickname.length > 0 && !nicknameValid && (
                <div className="text-terminal-red text-[10px]">
                  3-20 characters, letters/numbers/spaces/CJK only
                </div>
              )}
            </div>

            {/* ───── GDPR Consent (clearly readable) ───── */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gdprAgreed}
                onChange={(e) => setGdprAgreed(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-terminal-green"
              />
              <span className="text-xs text-terminal-text leading-snug">
                I consent to public display of my photo on the projection wall
                during this session.
              </span>
            </label>

            {/* ───── Optional email (aftermath sequence) ───── */}
            <div className="space-y-1 border-l border-terminal-border/40 pl-2">
              <label className="text-terminal-dim text-[10px] block">
                Optional: email address (we will send your Digital Passport here)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-black border border-terminal-border text-terminal-text px-3 py-1.5 text-sm focus:outline-none focus:border-terminal-green"
              />
              {email && !emailValid && (
                <div className="text-terminal-red text-[10px]">
                  Please enter a valid email address.
                </div>
              )}
              {wantsEmail && (
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={emailConsent}
                    onChange={(e) => setEmailConsent(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-terminal-green"
                  />
                  <span className="text-[11px] text-terminal-text leading-snug">
                    I consent to receive up to 5 follow-up emails over 7 days
                    about my optimization profile. I can unsubscribe at any time
                    with one click.
                  </span>
                </label>
              )}
            </div>

            {/* ───── Optional re-entry code ───── */}
            <div className="space-y-1">
              <label className="text-terminal-dim text-[10px] block">
                Optional: last 4 digits of your phone number (for cross-device re-entry)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
                className="w-32 bg-black border border-terminal-border text-terminal-text px-3 py-1.5 text-sm tracking-widest focus:outline-none focus:border-terminal-green"
              />
              {phoneLast4 && !phoneValid && (
                <div className="text-terminal-red text-[10px]">Must be exactly 4 digits.</div>
              )}
            </div>

            {/* ───── ToS (dark pattern) ───── */}
            <div className="space-y-2">
              <div className="text-terminal-dim text-[10px] tracking-widest">
                ☐ OPTIMIZATION TERMS
              </div>
              <div
                ref={termsRef}
                className="h-24 overflow-y-auto text-terminal-dim text-[9px] leading-relaxed border border-terminal-border p-2 scroll-smooth"
              >
                <pre className="whitespace-pre-wrap font-mono">{TERMS_OF_SERVICE}</pre>
              </div>
              <div className="text-terminal-dim text-[9px] italic">
                [scrolled past in 0.3 seconds]
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="w-4 h-4 accent-terminal-green"
                />
                <span className="text-[11px] text-terminal-text">
                  I agree to the Expression Optimization Terms
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
            {!canSubmit && step === "form" && (
              <div className="text-terminal-dim text-[10px]">
                Complete all four fields to continue.
              </div>
            )}
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
