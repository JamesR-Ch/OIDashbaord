import { NextRequest, NextResponse } from "next/server";
import { AuthError, getAuthContextFromToken } from "../../../../lib/auth";

function readBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function maskToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 14) return `${token.slice(0, 3)}...${token.slice(-2)}`;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

async function resolveContext(token: string | null) {
  if (!token) {
    return {
      has_token: false,
      token_masked: null,
      ok: false,
      status: 401,
      error: "missing token",
      user_id: null,
      role: null,
      email: null
    };
  }

  try {
    const ctx = await getAuthContextFromToken(token);
    return {
      has_token: true,
      token_masked: maskToken(token),
      ok: true,
      status: 200,
      error: null,
      user_id: ctx.userId,
      role: ctx.role,
      email: ctx.email
    };
  } catch (error: any) {
    const status = error instanceof AuthError ? error.status : 500;
    return {
      has_token: true,
      token_masked: maskToken(token),
      ok: false,
      status,
      error: error?.message || "unknown auth error",
      user_id: null,
      role: null,
      email: null
    };
  }
}

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get("oid_access_token")?.value || null;
  const bearerToken = readBearer(req);

  const [cookie, bearer] = await Promise.all([
    resolveContext(cookieToken),
    resolveContext(bearerToken)
  ]);

  return NextResponse.json({
    ok: true,
    now_utc: new Date().toISOString(),
    path: req.nextUrl.pathname,
    cookie,
    bearer,
    mismatch:
      cookie.ok &&
      bearer.ok &&
      cookie.user_id &&
      bearer.user_id &&
      cookie.user_id !== bearer.user_id
  });
}

