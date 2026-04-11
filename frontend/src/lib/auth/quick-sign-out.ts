"use client";

import { removeSession } from "@/lib/session-tracker";
import { createClient } from "@/lib/supabase/client";

export async function quickSignOut(redirectTo = "/login") {
  const supabase = createClient();

  try {
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id && session.access_token) {
        await removeSession(supabase, session.user.id, session.access_token);
      }

      // Clear the current browser session immediately instead of waiting for
      // a slower global revoke call to finish over the network.
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    console.error("[quickSignOut] signOut failed:", error);
  }

  window.location.replace(redirectTo);
}
