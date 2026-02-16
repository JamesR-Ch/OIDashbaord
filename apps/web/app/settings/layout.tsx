import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, getAuthContextFromToken } from "../../lib/auth";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("oid_access_token")?.value;

  if (!token) {
    redirect("/login?next=/settings");
  }

  try {
    const auth = await getAuthContextFromToken(token);
    if (auth.role !== "admin") {
      redirect("/overview");
    }
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) {
        redirect("/login?next=/settings");
      }
      redirect("/login?next=/settings");
    }
    redirect("/login?next=/settings");
  }

  return <>{children}</>;
}
