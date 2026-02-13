import { NextRequest } from "next/server";
import { getAdminDb } from "./db";

export type AppRole = "admin" | "viewer";

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getAuthContextFromToken(
  token: string
): Promise<{ userId: string; role: AppRole; email: string | null }> {
  const adminDb = getAdminDb();
  const { data, error } = await adminDb.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError(401, "invalid or expired token");
  }

  const { data: roleRow, error: roleError } = await adminDb
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (roleError) {
    throw new AuthError(500, roleError.message);
  }

  const role: AppRole = roleRow?.role === "admin" ? "admin" : "viewer";

  return {
    userId: data.user.id,
    role,
    email: data.user.email ?? null
  };
}

export async function getAuthContext(req: NextRequest): Promise<{ userId: string; role: AppRole; email: string | null }> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AuthError(401, "missing bearer token");
  }
  return getAuthContextFromToken(token);
}

export async function assertAuthenticated(req: NextRequest): Promise<{ userId: string; role: AppRole; email: string | null }> {
  return getAuthContext(req);
}

export async function assertAdmin(req: NextRequest): Promise<{ userId: string; role: AppRole; email: string | null }> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "admin") {
    throw new AuthError(403, "admin role required");
  }
  return ctx;
}
