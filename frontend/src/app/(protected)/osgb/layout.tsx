import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

type OsgbLayoutProps = {
  children: ReactNode;
};

export default async function OsgbLayout({ children }: OsgbLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getAccountContextForUser(user.id);

  if (context.isPlatformAdmin) {
    redirect("/platform-admin");
  }

  if (context.accountType !== "osgb") {
    redirect(resolvePostLoginPath(context));
  }

  if (!hasOsgbManagementAccess(context)) {
    redirect("/companies");
  }

  return <>{children}</>;
}
