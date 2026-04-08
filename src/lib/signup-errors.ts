import type { ZodError } from "zod";

/** Short, user-facing copy for signup validation failures (avoid raw Zod dumps). */
export function formatSignupValidationError(error: ZodError): string {
  const fieldErrors = error.flatten().fieldErrors as Partial<
    Record<"email" | "password" | "firstName" | "lastName" | "countryCode", string[] | undefined>
  >;
  if (fieldErrors.email?.[0]) {
    return "Enter a valid email address.";
  }
  if (fieldErrors.password?.[0]) {
    return "Use a password of at least 8 characters.";
  }
  if (fieldErrors.firstName?.[0]) {
    return "First name looks invalid or is too long.";
  }
  if (fieldErrors.lastName?.[0]) {
    return "Last name looks invalid or is too long.";
  }
  if (fieldErrors.countryCode?.[0]) {
    return "Country code looks invalid.";
  }
  return "Some details need fixing. Check the form and try again.";
}

/** Readable message from a failed signup `fetch` response body. */
export function messageFromSignupResponse(res: Response, data: unknown): string {
  const fallback =
    res.status === 503
      ? "We're having trouble connecting right now. Please wait a few seconds and try again."
      : res.status >= 500
        ? "Something went wrong on our end. Please try again in a moment."
        : "Something went wrong. Please try again.";
  if (typeof data !== "object" || data === null) {
    return fallback;
  }
  const error =
    "error" in data && typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : null;
  return error ?? fallback;
}
