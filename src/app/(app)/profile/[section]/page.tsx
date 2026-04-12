import { notFound } from "next/navigation";

import { ProfileSettingsHeader } from "@/components/profile-settings-header";

const SECTION_COPY: Record<string, { title: string; body: string }> = {
  language: {
    title: "Language",
    body: "Language preferences are coming soon. The app currently follows your device locale where supported.",
  },
  appearance: {
    title: "Appearance",
    body: "Theme and display options are coming soon.",
  },
  security: {
    title: "Security",
    body: "Extra security controls (passkeys, sessions, and more) are coming soon.",
  },
  notifications: {
    title: "Notification",
    body: "Notification settings are coming soon.",
  },
  legal: {
    title: "Legal",
    body: "Terms of service and privacy policy will be linked here. Contact support if you need documents today.",
  },
};

type Props = { params: Promise<{ section: string }> };

export default async function ProfileSectionPage({ params }: Props) {
  const { section } = await params;
  const copy = SECTION_COPY[section];
  if (!copy) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-2">
      <ProfileSettingsHeader
        backHref="/profile"
        backLabel="Settings"
        title={copy.title}
        backAriaLabel="Back to settings"
      />
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_14px_rgba(13,24,21,0.04)]">
        <p className="text-sm leading-relaxed text-muted">{copy.body}</p>
      </div>
    </div>
  );
}
