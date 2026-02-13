import { createClient } from "@supabase/supabase-js";
import { config, requireEnv } from "./config";

export function getAdminDb() {
  const supabaseUrl = requireEnv("SUPABASE_URL", config.supabaseUrl);
  const supabaseServiceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceRole);

  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false }
  });
}
