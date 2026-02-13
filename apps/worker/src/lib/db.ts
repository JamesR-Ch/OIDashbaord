import { createClient } from "@supabase/supabase-js";
import { workerConfig } from "./config";

if (!workerConfig.supabaseUrl || !workerConfig.supabaseServiceRole) {
  throw new Error("Missing Supabase worker credentials");
}

export const db = createClient(workerConfig.supabaseUrl, workerConfig.supabaseServiceRole, {
  auth: { persistSession: false }
});
