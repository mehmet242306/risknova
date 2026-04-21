import { redirect } from "next/navigation";
import { WorkspaceOnboardingClient } from "../workspace/onboarding/WorkspaceOnboardingClient";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
} from "@/lib/account/account-routing";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const context = await getAccountContextForUser(user.id);
    if (hasOsgbManagementAccess(context)) {
      redirect("/osgb/firms");
    }
  }

  return <WorkspaceOnboardingClient />;
}
