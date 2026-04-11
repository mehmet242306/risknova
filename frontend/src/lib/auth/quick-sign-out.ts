"use client";

import { createClient } from "@/lib/supabase/client";

export async function quickSignOut(redirectTo = "/login") {
  const supabase = createClient();

  try {
    if (supabase) {
      // Clear the current browser session immediately instead of waiting for
      // a slower global revoke call to finish over the network.
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    console.error("[quickSignOut] signOut failed:", error);
  }

  window.location.replace(redirectTo);
}
