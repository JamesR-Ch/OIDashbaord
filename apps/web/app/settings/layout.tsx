import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, getAuthContextFromToken } from "../../lib/auth";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("oid_access_token")?.value;

  if (!token) {
    redirect("/login?next=/settings&auth_debug_reason=settings_no_cookie");
  }

  try {
    const auth = await getAuthContextFromToken(token);
    if (auth.role !== "admin") {
      redirect("/overview?auth_debug_reason=settings_non_admin");
    }
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) {
        redirect("/login?next=/settings&auth_debug_reason=settings_invalid_token");
      }
      redirect(`/login?next=/settings&auth_debug_reason=settings_auth_error_${error.status}`);
    }
    redirect("/login?next=/settings&auth_debug_reason=settings_unknown_auth_error");
  }

  return <>{children}</>;
}
