import { describe, expect, it } from "vitest";
import { getRolloutBucket, resolveFeatureFlag } from "./governance";

describe("getRolloutBucket", () => {
  it("is deterministic for the same identity", () => {
    expect(getRolloutBucket("nova.agent.chat:user-1")).toBe(
      getRolloutBucket("nova.agent.chat:user-1"),
    );
  });
});

describe("resolveFeatureFlag", () => {
  it("prefers workspace over organization and global rows", () => {
    const resolved = resolveFeatureFlag(
      [
        {
          id: "global",
          feature_key: "nova.agent.chat",
          organization_id: null,
          workspace_id: null,
          is_enabled: true,
          rollout_percentage: 100,
          config: {},
        },
        {
          id: "org",
          feature_key: "nova.agent.chat",
          organization_id: "org-1",
          workspace_id: null,
          is_enabled: false,
          rollout_percentage: 0,
          config: {},
        },
        {
          id: "workspace",
          feature_key: "nova.agent.chat",
          organization_id: "org-1",
          workspace_id: "ws-1",
          is_enabled: true,
          rollout_percentage: 50,
          config: {},
        },
      ],
      {
        featureKey: "nova.agent.chat",
        organizationId: "org-1",
        workspaceId: "ws-1",
      },
    );

    expect(resolved?.id).toBe("workspace");
  });
});
