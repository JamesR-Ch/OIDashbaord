import { NextRequest, NextResponse } from "next/server";

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/settings")) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = req.cookies.get("oid_access_token")?.value;
  if (token) {
    return withSecurityHeaders(NextResponse.next());
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return withSecurityHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png).*)"]
};
