"use client";

import { ArrowRight, ChevronLeft, Eye, EyeOff, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeedbackModal } from "@/components/feedback-modal";
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { UnderlineInput } from "@/components/underline-input";

const MAIN_TEXT = "text-[#16211F]";

type LoginStep = "email" | "password";

type LoginFeedback =
  | null
  | {
      variant: "success" | "error";
      title: string;
      message: string;
    };

const LOGIN_HELP: Record<LoginStep, { title: string; body: string }> = {
  email: {
    title: "Email",
    body: "Use the same email you signed up with. If you went through Get started and onboarding, that’s the address you entered first.",
  },
  password: {
    title: "Password",
    body: "Enter the password you created during onboarding, at least 8 characters. Use the eye icon to check what you typed.",
  },
};

export function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState<LoginFeedback>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8;

  function back() {
    if (step === "email") {
      router.push("/get-started");
    } else {
      setStep("email");
    }
  }

  function goToPassword() {
    if (!emailOk) return;
    setStep("password");
  }

  async function submitLogin() {
    if (!emailOk || !passwordOk) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });
      const data: unknown = await res.json().catch(() => ({}));
      const msg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : res.status >= 500
            ? "Our servers are having trouble. Please try again in a moment."
            : "Something went wrong. Please try again.";
      if (!res.ok) {
        setFeedback({
          variant: "error",
          title: "Couldn't sign in",
          message: msg,
        });
        return;
      }
      setFeedback({
        variant: "success",
        title: "You're in",
        message: "Welcome back to Kudi.",
      });
    } catch {
      setFeedback({
        variant: "error",
        title: "Connection problem",
        message: "Could not reach the server. Check your internet and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const roundIconBtn =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white active:bg-neutral-50";

  const primaryCta =
    "min-h-12 w-full rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover disabled:opacity-40";

  const newUserCard =
    "group flex w-full items-center gap-3 rounded-xl border border-border bg-primary-muted/25 px-4 py-3.5 text-left transition-colors active:bg-primary-muted/50";

  return (
    <div className={`flex min-h-dvh flex-col bg-white ${MAIN_TEXT}`}>
      <div className="flex flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button type="button" onClick={back} className={roundIconBtn} aria-label="Back">
            <ChevronLeft className="size-6" strokeWidth={1.5} />
          </button>
          <button type="button" onClick={() => setHelpOpen(true)} className={roundIconBtn} aria-label="Help">
            <HelpCircle className="size-6" strokeWidth={1.5} />
          </button>
        </header>

        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          {step === "email" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Enter your email address</h1>
              <div className="mt-8">
                <UnderlineInput
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && emailOk) {
                      e.preventDefault();
                      goToPassword();
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Enter your password</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Signing in as <span className="font-medium text-[#16211F]">{email.trim()}</span>
              </p>
              <div className="relative mt-8">
                <UnderlineInput
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && passwordOk && !pending) {
                      e.preventDefault();
                      void submitLogin();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-5" strokeWidth={1.5} /> : <Eye className="size-5" strokeWidth={1.5} />}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto space-y-4 pt-8">
          {step === "email" ? (
            <button type="button" disabled={!emailOk} className={primaryCta} onClick={goToPassword}>
              Continue
            </button>
          ) : (
            <button type="button" disabled={!passwordOk || pending} className={primaryCta} onClick={() => void submitLogin()}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          )}

          <Link href="/get-started" className={newUserCard}>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${MAIN_TEXT}`}>New to Kudi?</p>
              <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                Create your account — same flow as Get started and onboarding.
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              Get started
              <ArrowRight className="size-4 transition-transform group-active:translate-x-0.5" strokeWidth={2} aria-hidden />
            </span>
          </Link>
        </div>
      </div>

      <MobileBottomSheet open={helpOpen} onOpenChange={setHelpOpen} title={LOGIN_HELP[step].title}>
        <p className="text-base leading-relaxed text-neutral-600">{LOGIN_HELP[step].body}</p>
      </MobileBottomSheet>

      {feedback ? (
        <FeedbackModal
          open
          onOpenChange={(open) => {
            if (!open) setFeedback(null);
          }}
          variant={feedback.variant}
          title={feedback.title}
          message={feedback.message}
          primaryLabel={feedback.variant === "success" ? "Continue" : "Try again"}
          onPrimary={
            feedback.variant === "success"
              ? () => {
                  router.push("/home");
                  router.refresh();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
