import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const context = await getAccountContextForUser(user.id);
    const nextPath = resolvePostLoginPath(context);
    if (nextPath !== "/dashboard") {
      redirect(nextPath);
    }
  }

  return <DashboardClient />;
}
