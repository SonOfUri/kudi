"use client";

import {
  Ban,
  Camera,
  ChevronLeft,
  Eye,
  EyeOff,
  HelpCircle,
  ImageIcon,
  Search,
  Signal,
  Smile,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FeedbackModal } from "@/components/feedback-modal";
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { UnderlineInput } from "@/components/underline-input";
import { setKudiLocalProfile } from "@/lib/kudi-local-profile";
import { messageFromSignupResponse } from "@/lib/signup-errors";

const MAIN_TEXT = "text-[#16211F]";

type AccountFeedback =
  | null
  | {
      variant: "success" | "error";
      title: string;
      message: string;
      offerSignIn?: boolean;
    };

type StepId =
  | "email"
  | "password"
  | "confirm"
  | "country"
  | "firstName"
  | "lastName"
  | "avatar";

const STEPS: { id: StepId }[] = [
  { id: "email" },
  { id: "password" },
  { id: "confirm" },
  { id: "country" },
  { id: "firstName" },
  { id: "lastName" },
  { id: "avatar" },
];

const ONBOARDING_HELP: Record<StepId, { title: string; body: string }> = {
  email: {
    title: "Email",
    body: "Use an address you can access—we’ll send important account updates and sign-in links there. This becomes your login email.",
  },
  password: {
    title: "Password",
    body: "Create a strong password (at least 8 characters). Longer passwords with numbers and symbols protect your account. You can show or hide what you type with the eye icon.",
  },
  confirm: {
    title: "Confirm password",
    body: "Re-enter the exact same password so we know there were no typos. Both fields must match before you can continue.",
  },
  country: {
    title: "Country",
    body: "We use your country for regional settings, compliance, and relevant product options. Search to find yours faster. You can skip if you prefer to add this later.",
  },
  firstName: {
    title: "First name",
    body: "Enter your legal first name as it appears on your ID. This helps with verification and support. You can skip and complete your profile later if you need to.",
  },
  lastName: {
    title: "Last name",
    body: "Enter your legal last name as it appears on your ID. This helps with verification and support. You can skip and complete your profile later if you need to.",
  },
  avatar: {
    title: "Avatar",
    body: "Pick a photo or emoji to represent you in the app. You can change it anytime from your profile. Tap the circle below to open options.",
  },
};

type CountryRow = { code: string; name: string; flag: string };

const COUNTRIES: CountryRow[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
];

const EMOJI_OPTIONS = ["😀", "🙂", "😎", "🌿", "✨", "🦁"];

function passwordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { level: 0, label: "Password Strength" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 10) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const level = (Math.min(score, 3) || 1) as 1 | 2 | 3;
  if (score <= 1) return { level: 1, label: "Password Strength" };
  if (score <= 2) return { level: 2, label: "Password Strength" };
  return { level: 3, label: "Password Strength" };
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [countryQuery, setCountryQuery] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<AccountFeedback>(null);
  const [accountPending, setAccountPending] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm: "",
    country: "",
    firstName: "",
    lastName: "",
    avatarEmoji: "" as string,
  });

  const current = STEPS[step]!;

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countryQuery]);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  function back() {
    if (step === 0) router.push("/get-started");
    else setStep((s) => s - 1);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function canContinue(): boolean {
    switch (current.id) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      case "password":
        return form.password.length >= 8;
      case "confirm":
        return form.confirm === form.password && form.confirm.length >= 8;
      case "country":
        return form.country.length > 0;
      case "firstName":
        return form.firstName.trim().length > 0;
      case "lastName":
        return form.lastName.trim().length > 0;
      case "avatar":
        return form.avatarEmoji.length > 0;
      default:
        return false;
    }
  }

  async function completeSignup() {
    setAccountPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          countryCode: form.country.trim() || undefined,
        }),
        credentials: "include",
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = messageFromSignupResponse(res, data);
        setAccountFeedback({
          variant: "error",
          title: "Couldn't create your account",
          message: msg,
          offerSignIn: msg.toLowerCase().includes("already exists"),
        });
        return;
      }
      setKudiLocalProfile({ avatarEmoji: form.avatarEmoji });
      setAccountFeedback({
        variant: "success",
        title: "Welcome to Kudi",
        message: "Your account is ready. Let's go!",
      });
    } catch {
      setAccountFeedback({
        variant: "error",
        title: "Connection problem",
        message: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setAccountPending(false);
    }
  }

  const roundIconBtn =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white active:bg-neutral-50";

  /* Match get-started / auth: min-h-12, rounded-xl */
  const primaryCta =
    "min-h-12 w-full rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover disabled:opacity-40";
  const secondaryCta =
    "min-h-12 flex-1 rounded-xl border border-border px-5 text-base font-medium text-foreground active:bg-primary-muted";
  const primaryCtaSplit = `${primaryCta} flex-1`;

  return (
    <div className={`flex min-h-dvh flex-col bg-white ${MAIN_TEXT}`}>
      <div
        className="flex flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <header className="flex items-center justify-between">
          <button type="button" onClick={back} className={roundIconBtn} aria-label="Back">
            <ChevronLeft className="size-6" strokeWidth={1.5} />
          </button>
          <button type="button" onClick={() => setHelpOpen(true)} className={roundIconBtn} aria-label="Help">
            <HelpCircle className="size-6" strokeWidth={1.5} />
          </button>
        </header>

        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          {/* Email */}
          {current.id === "email" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Enter your email address</h1>
              <div className="mt-8">
                <UnderlineInput
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </>
          ) : null}

          {/* Password */}
          {current.id === "password" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Set Password</h1>
              <div className="relative mt-8">
                <UnderlineInput
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-12"
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
              <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
                <Signal className="size-4" strokeWidth={1.5} />
                <span>{strength.label}</span>
              </div>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i <= strength.level ? "bg-primary" : "bg-neutral-200"}`}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                Strong passwords are often 10 characters or more and include a special character and a number.
              </p>
            </>
          ) : null}

          {/* Confirm password */}
          {current.id === "confirm" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Confirm Password</h1>
              <div className="relative mt-8">
                <UnderlineInput
                  type={showPwConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Password"
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm((v) => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400"
                  aria-label={showPwConfirm ? "Hide password" : "Show password"}
                >
                  {showPwConfirm ? (
                    <EyeOff className="size-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="size-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {form.confirm.length > 0 && form.confirm !== form.password ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
                  <Ban className="size-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
                  <span>Passwords Must Match</span>
                </div>
              ) : null}
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                In order to continue, your password must match exactly what you entered before.
              </p>
            </>
          ) : null}

          {/* Country */}
          {current.id === "country" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Your Country</h1>
              <p className="mt-2 text-base text-neutral-500">Select which country you live in.</p>
              <div className="relative mt-6">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} />
                <input
                  type="search"
                  placeholder="Search Countries"
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white py-3.5 pl-12 pr-4 text-base outline-none ring-0 placeholder:text-neutral-400 focus:border-primary"
                />
              </div>
              <ul className="mt-4 max-h-[min(42vh,320px)] min-h-[120px] flex-1 space-y-0 overflow-y-auto rounded-xl border border-neutral-100">
                {filteredCountries.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, country: c.code }))}
                      className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3.5 text-left last:border-b-0 active:bg-neutral-50 ${
                        form.country === c.code ? "bg-primary-muted/40" : ""
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>
                        {c.flag}
                      </span>
                      <span className={`flex-1 text-base font-medium ${MAIN_TEXT}`}>{c.name}</span>
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          form.country === c.code ? "border-primary bg-primary" : "border-neutral-300"
                        }`}
                        aria-hidden
                      >
                        {form.country === c.code ? <span className="block size-2 rounded-full bg-white" /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* First name */}
          {current.id === "firstName" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">First Name</h1>
              <div className="mt-8">
                <UnderlineInput
                  type="text"
                  autoComplete="given-name"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                Please enter your first name exactly as it appears on your drivers license or government issued ID.
              </p>
            </>
          ) : null}

          {/* Last name */}
          {current.id === "lastName" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Last Name</h1>
              <div className="mt-8">
                <UnderlineInput
                  type="text"
                  autoComplete="family-name"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                Please enter your last name exactly as it appears on your drivers license or government issued ID.
              </p>
            </>
          ) : null}

          {/* Avatar */}
          {current.id === "avatar" ? (
            <>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Your Avatar</h1>
              <p className="mt-2 text-base text-neutral-500">
                Finally, let&apos;s choose an avatar for your account.
              </p>
              <button
                type="button"
                onClick={() => setAvatarSheetOpen(true)}
                className="mx-auto mt-10 flex size-32 items-center justify-center rounded-full border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-300 active:bg-neutral-100"
                aria-label="Choose avatar"
              >
                {form.avatarEmoji ? (
                  <span className="text-5xl">{form.avatarEmoji}</span>
                ) : (
                  <UserRound className="size-16" strokeWidth={1.25} />
                )}
              </button>
            </>
          ) : null}
        </div>

        {/* Footer CTAs */}
        <div className="mt-auto pt-8">
          {current.id === "country" || current.id === "firstName" || current.id === "lastName" ? (
            <div className="flex gap-3">
              <button
                type="button"
                className={secondaryCta}
                onClick={() => {
                  if (current.id === "country") setForm((f) => ({ ...f, country: "" }));
                  if (current.id === "firstName") setForm((f) => ({ ...f, firstName: "" }));
                  if (current.id === "lastName") setForm((f) => ({ ...f, lastName: "" }));
                  next();
                }}
              >
                Skip
              </button>
              <button type="button" disabled={!canContinue()} className={primaryCtaSplit} onClick={next}>
                Continue
              </button>
            </div>
          ) : current.id === "avatar" ? (
            <button
              type="button"
              disabled={!canContinue() || accountPending}
              className={primaryCta}
              onClick={() => void completeSignup()}
            >
              {accountPending ? "Creating account…" : "Continue"}
            </button>
          ) : (
            <button type="button" disabled={!canContinue()} className={primaryCta} onClick={next}>
              Continue
            </button>
          )}
        </div>
      </div>

      <MobileBottomSheet open={helpOpen} onOpenChange={setHelpOpen} title={ONBOARDING_HELP[current.id].title}>
        <p className="text-base leading-relaxed text-neutral-600">{ONBOARDING_HELP[current.id].body}</p>
      </MobileBottomSheet>

      {accountFeedback ? (
        <FeedbackModal
          open
          onOpenChange={(open) => {
            if (!open) setAccountFeedback(null);
          }}
          variant={accountFeedback.variant}
          title={accountFeedback.title}
          message={accountFeedback.message}
          primaryLabel={accountFeedback.variant === "success" ? "Continue" : "OK"}
          onPrimary={
            accountFeedback.variant === "success"
              ? () => {
                  router.push("/home");
                  router.refresh();
                }
              : undefined
          }
          secondaryLabel={accountFeedback.offerSignIn ? "Sign in instead" : undefined}
          onSecondary={
            accountFeedback.offerSignIn
              ? () => {
                  router.push("/login");
                }
              : undefined
          }
        />
      ) : null}

      <MobileBottomSheet open={avatarSheetOpen} onOpenChange={setAvatarSheetOpen} title="Select Avatar">
        <div className="flex flex-col gap-2 pb-2">
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-4 text-left active:bg-neutral-50"
            onClick={() => {
              setForm((f) => ({ ...f, avatarEmoji: "📷" }));
              setAvatarSheetOpen(false);
            }}
          >
            <Camera className="size-6 text-[#16211F]" strokeWidth={1.5} />
            <span className="font-medium text-[#16211F]">Take Photo</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-4 text-left active:bg-neutral-50"
            onClick={() => {
              setForm((f) => ({ ...f, avatarEmoji: "🖼️" }));
              setAvatarSheetOpen(false);
            }}
          >
            <ImageIcon className="size-6 text-[#16211F]" strokeWidth={1.5} />
            <span className="font-medium text-[#16211F]">Choose Photo</span>
          </button>
          <div className="rounded-2xl border border-neutral-200 px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <Smile className="size-6 text-[#16211F]" strokeWidth={1.5} />
              <span className="font-medium text-[#16211F]">Choose Emoji</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex size-12 items-center justify-center rounded-xl bg-neutral-50 text-2xl active:bg-neutral-100"
                  onClick={() => {
                    setForm((f) => ({ ...f, avatarEmoji: emoji }));
                    setAvatarSheetOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
