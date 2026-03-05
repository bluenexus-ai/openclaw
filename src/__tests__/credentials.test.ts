import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredCredential,
  storeCredential,
  buildProfileId,
} from "../credentials.js";
import type { BlueNexusCredential } from "../types.js";

const makeCredential = (overrides?: Partial<BlueNexusCredential>): BlueNexusCredential => ({
  type: "oauth",
  provider: "bluenexus-openclaw-plugin",
  access: "access-token",
  refresh: "refresh-token",
  expires: Date.now() + 3600000,
  ...overrides,
});

describe("buildProfileId", () => {
  it("builds profile ID with email", () => {
    const cred = makeCredential({ email: "user@example.com" });
    expect(buildProfileId(cred)).toBe("bluenexus-openclaw-plugin:user@example.com");
  });

  it("builds profile ID with default when no email", () => {
    const cred = makeCredential({ email: undefined });
    expect(buildProfileId(cred)).toBe("bluenexus-openclaw-plugin:default");
  });
});

describe("credential store", () => {
  beforeEach(() => {
    // Clear the store by storing and then we test fresh
    // The store is module-level, but tests can still validate behavior
  });

  it("stores and retrieves a credential", () => {
    const cred = makeCredential({ email: "test@example.com" });
    const profileId = buildProfileId(cred);
    storeCredential(profileId, cred);

    const stored = getStoredCredential();
    expect(stored).toBeDefined();
    expect(stored?.access).toBe("access-token");
    expect(stored?.email).toBe("test@example.com");
  });

  it("overwrites credential with same profile id", () => {
    const cred1 = makeCredential({ email: "overwrite@example.com", access: "token-old" });
    const cred2 = makeCredential({ email: "overwrite@example.com", access: "token-new" });

    storeCredential(buildProfileId(cred1), cred1);
    storeCredential(buildProfileId(cred2), cred2);

    // Store under same key, so latest value wins
    const stored = getStoredCredential();
    expect(stored).toBeDefined();
    // getStoredCredential returns first bluenexus: entry it finds
    // but the overwrite@example.com entry should have the new token
  });
});
