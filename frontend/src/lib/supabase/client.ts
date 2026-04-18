import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton: birden fazla GoTrue örneği "Failed to fetch" hatasına yol açar
// (navigator.locks üzerinde yarışan _useSession çağrıları birbirini abort eder).
let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    null;

  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  browserClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
