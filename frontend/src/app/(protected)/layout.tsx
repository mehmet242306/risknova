import type { ReactNode } from "react";
import { ProtectedShell } from "@/components/layout/protected-shell";
import { createClient } from "@/lib/supabase/server";
import { getAccountContextForUser } from "@/lib/account/account-routing";
import type { AccountContextPayload } from "@/lib/account/account-api";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (proxy.ts) zaten auth gating yapıyor; user null ise oraya
  // güvenip render et — client-side ProtectedShell de fallback redirect yapar.
  if (!user) {
    return <ProtectedShell>{children}</ProtectedShell>;
  }

  let initialAccountContext: AccountContextPayload | null = null;
  let initialIsAdmin: boolean | null = null;
  let initialHasActiveWorkspace = false;

  try {
    const ctx = await getAccountContextForUser(user.id);
    initialAccountContext = {
      userId: ctx.userId,
      isPlatformAdmin: ctx.isPlatformAdmin,
      organizationId: ctx.organizationId,
      organizationName: ctx.organizationName,
      accountType: ctx.accountType,
      allowedAccountTypes: ctx.allowedAccountTypes,
      membershipRole: ctx.membershipRole,
      currentPlanCode: ctx.currentPlanCode,
    };
    initialIsAdmin = ctx.isPlatformAdmin;
    initialHasActiveWorkspace = !!ctx.activeWorkspaceId;
  } catch {
    // Fallback: SSR fetch başarısız olursa client-side fetch devreye girer.
  }

  return (
    <ProtectedShell
      initialAccountContext={initialAccountContext}
      initialIsAdmin={initialIsAdmin}
      initialHasActiveWorkspace={initialHasActiveWorkspace}
    >
      {children}
    </ProtectedShell>
  );
}
