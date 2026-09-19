import { SignJWT, jwtVerify } from "jose";

export const rpName = process.env.WEBAUTHN_RP_NAME || "Cafe Attendance";
export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
export const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret"
);

// ponytail: challenge travels as a 2-minute JWT instead of a DB row; swap for a table if multi-instance replay matters.
export async function sealChallenge(challenge: string, userId: number) {
  return new SignJWT({ challenge, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2m")
    .sign(secret);
}

// ponytail: in-memory single-use set; one process on one laptop, so no DB table.
const used = new Set<string>();

export async function openChallenge(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (used.has(token)) throw new Error("Challenge already used");
  used.add(token);
  setTimeout(() => used.delete(token), 2 * 60_000).unref();
  return payload as { challenge: string; userId: number };
}
