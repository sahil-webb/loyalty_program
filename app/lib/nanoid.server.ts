import { randomBytes } from "crypto";

/** Generate a URL-safe 10-char referral code */
export function nanoid(size = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(size);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}
