import crypto from "node:crypto";

export function verifyHmacSha256(secret: string, payload: string, signature?: string | null): boolean {
  if (!signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expected = `sha256=${digest}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
