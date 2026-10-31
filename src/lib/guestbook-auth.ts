import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { getSecret } from "astro:env/server";
import { OWNER_HINT_COOKIE } from "./guestbook";

const COOKIE_NAME = "guestbook-admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const MIN_SECRET_LENGTH = 32;

// A missing or short secret disables admin access entirely.
const readSecret = (): string | undefined => {
  const secret = getSecret("GUESTBOOK_ADMIN_SECRET");
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : undefined;
};

const sha256 = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(sha256(a), sha256(b));

// Derived from the secret, so the cookie never holds the secret itself and
// rotating the secret logs out every session.
const sessionValue = (secret: string): string =>
  createHmac("sha256", secret).update("guestbook-admin-session").digest("hex");

export const isGuestbookAdmin = (cookies: AstroCookies): boolean => {
  const secret = readSecret();
  const session = cookies.get(COOKIE_NAME)?.value;
  return (
    secret !== undefined &&
    session !== undefined &&
    safeEqual(session, sessionValue(secret))
  );
};

export const logInAdmin = (
  cookies: AstroCookies,
  candidate: string,
): boolean => {
  const secret = readSecret();
  if (!secret || !safeEqual(candidate, secret)) return false;

  const options = {
    secure: import.meta.env.PROD,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
  cookies.set(COOKIE_NAME, sessionValue(secret), {
    ...options,
    httpOnly: true,
  });
  cookies.set(OWNER_HINT_COOKIE, "1", options);
  return true;
};

export const logOutAdmin = (cookies: AstroCookies): void => {
  cookies.delete(COOKIE_NAME, { path: "/" });
  cookies.delete(OWNER_HINT_COOKIE, { path: "/" });
};
