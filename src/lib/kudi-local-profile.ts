/** Browser-only profile bits that are not stored on the server (e.g. onboarding avatar emoji). */

export const KUDI_LOCAL_PROFILE_KEY = "kudi_local_profile";

export type KudiLocalProfile = {
  avatarEmoji?: string;
};

export function setKudiLocalProfile(profile: KudiLocalProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KUDI_LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode / quota */
  }
}

export function clearKudiLocalProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KUDI_LOCAL_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
