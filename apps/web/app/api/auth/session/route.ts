import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromToken } from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { config } from "../../../../lib/config";

function readBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const token = readBearer(req);
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  const currentCookieToken = req.cookies.get("oid_access_token")?.value;
  if (currentCookieToken && currentCookieToken === token) {
    return NextResponse.json({ ok: true, reused: true });
  }

  const clientIp = getClientIp(req);
  const rate = checkRateLimit(
    `auth_session:${clientIp}`,
    config.authSessionRateLimitPerMinute,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "too many auth session requests", retry_after_ms: rate.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    await getAuthContextFromToken(token);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("oid_access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("oid_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
