import { describe, expect, it } from "vitest";
import {
  hasOsgbManagementAccess,
  resolveAccountSurface,
  resolvePostLoginPath,
  type AccountContext,
} from "./account-routing";

function makeContext(
  overrides: Partial<AccountContext> = {},
): AccountContext {
  return {
    userId: "user-1",
    isPlatformAdmin: false,
    organizationId: "org-1",
    organizationName: "RiskNova Ornek",
    accountType: "individual",
    allowedAccountTypes: ["individual"],
    membershipRole: "owner",
    currentPlanCode: "individual_free",
    activeWorkspaceId: "ws-1",
    workspaceCount: 1,
    ...overrides,
  };
}

describe("resolvePostLoginPath", () => {
  it("always prioritizes platform admin over customer account type", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          isPlatformAdmin: true,
          accountType: "osgb",
        }),
      ),
    ).toBe("/platform-admin");
  });

  it("routes users without account context to onboarding", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          organizationId: null,
          accountType: null,
          activeWorkspaceId: null,
          workspaceCount: 0,
        }),
      ),
    ).toBe("/workspace/onboarding");
  });

  it("routes individual accounts with an active workspace to dashboard", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "individual",
        }),
      ),
    ).toBe("/dashboard");
  });

  it("routes fresh individual accounts without any workspace to onboarding", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "individual",
          activeWorkspaceId: null,
          workspaceCount: 0,
        }),
      ),
    ).toBe("/workspace/onboarding");
  });

  it("routes any customer account without an active country and role workspace to onboarding", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "osgb",
          membershipRole: "owner",
          activeWorkspaceId: null,
          workspaceCount: 0,
        }),
      ),
    ).toBe("/workspace/onboarding");
  });

  it("routes osgb accounts to the osgb dashboard", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "osgb",
          membershipRole: "owner",
        }),
      ),
    ).toBe("/osgb");
  });

  it("routes osgb staff to the professional surface instead of manager panel", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "osgb",
          membershipRole: "staff",
        }),
      ),
    ).toBe("/companies");
  });

  it("routes enterprise accounts to enterprise contact/status flow", () => {
    expect(
      resolvePostLoginPath(
        makeContext({
          accountType: "enterprise",
        }),
      ),
    ).toBe("/enterprise");
  });
});

describe("hasOsgbManagementAccess", () => {
  it("allows owner and admin roles", () => {
    expect(hasOsgbManagementAccess(makeContext({ accountType: "osgb", membershipRole: "owner" }))).toBe(true);
    expect(hasOsgbManagementAccess(makeContext({ accountType: "osgb", membershipRole: "admin" }))).toBe(true);
  });

  it("does not promote unknown osgb memberships to management access", () => {
    expect(hasOsgbManagementAccess(makeContext({ accountType: "osgb", membershipRole: null }))).toBe(false);
  });

  it("blocks non-manager roles and non-osgb accounts", () => {
    expect(hasOsgbManagementAccess(makeContext({ accountType: "osgb", membershipRole: "staff" }))).toBe(false);
    expect(hasOsgbManagementAccess(makeContext({ accountType: "individual", membershipRole: "owner" }))).toBe(false);
  });
});

describe("resolveAccountSurface", () => {
  it("prioritizes platform admin surface", () => {
    expect(
      resolveAccountSurface(
        makeContext({
          isPlatformAdmin: true,
          accountType: "osgb",
          membershipRole: "owner",
        }),
      ),
    ).toBe("platform-admin");
  });

  it("returns osgb-manager only for explicit osgb owner/admin", () => {
    expect(
      resolveAccountSurface(
        makeContext({
          accountType: "osgb",
          membershipRole: "owner",
        }),
      ),
    ).toBe("osgb-manager");

    expect(
      resolveAccountSurface(
        makeContext({
          accountType: "osgb",
          membershipRole: "staff",
        }),
      ),
    ).toBe("standard");
  });
});
