import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import path from "node:path";

// Monorepo-safe env loading: allow root .env when running from apps/web workspace.
dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });
dotenvConfig();

const nextPublicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const nextPublicSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const nextConfig: NextConfig = {
  typedRoutes: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: nextPublicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nextPublicSupabasePublishableKey
  }
};

export default nextConfig;
