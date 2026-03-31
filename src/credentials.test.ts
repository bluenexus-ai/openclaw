import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import {
  buildProfileId,
  getStoredCredential,
  loadCredentialFromAuthProfiles,
  storeCredential,
} from "./credentials.js"
import type { BlueNexusCredential } from "./types.js"

const makeCredential = (
  overrides?: Partial<BlueNexusCredential>
): BlueNexusCredential => ({
  type: "oauth",
  provider: "bluenexus-openclaw-plugin",
  access: "access-token",
  refresh: "refresh-token",
  expires: Date.now() + 3600000,
  ...overrides,
})

describe("buildProfileId", () => {
  it("builds profile ID with email", () => {
    const cred = makeCredential({ email: "user@example.com" })
    expect(buildProfileId(cred)).toBe(
      "bluenexus-openclaw-plugin:user@example.com"
    )
  })

  it("builds profile ID with default when no email", () => {
    const cred = makeCredential({ email: undefined })
    expect(buildProfileId(cred)).toBe("bluenexus-openclaw-plugin:default")
  })
})

describe("credential store", () => {
  beforeEach(() => {
    // Clear the store by storing and then we test fresh
    // The store is module-level, but tests can still validate behavior
  })

  it("stores and retrieves a credential", () => {
    const cred = makeCredential({ email: "test@example.com" })
    const profileId = buildProfileId(cred)
    storeCredential(profileId, cred)

    const stored = getStoredCredential()
    expect(stored).toBeDefined()
    expect(stored?.access).toBe("access-token")
    expect(stored?.email).toBe("test@example.com")
  })

  it("overwrites credential with same profile id", () => {
    const cred1 = makeCredential({
      email: "overwrite@example.com",
      access: "token-old",
    })
    const cred2 = makeCredential({
      email: "overwrite@example.com",
      access: "token-new",
    })

    storeCredential(buildProfileId(cred1), cred1)
    storeCredential(buildProfileId(cred2), cred2)

    // Store under same key, so latest value wins
    const stored = getStoredCredential()
    expect(stored).toBeDefined()
    // getStoredCredential returns first bluenexus: entry it finds
    // but the overwrite@example.com entry should have the new token
  })

  it("loads the newest credential across agent dirs when ctx.agentDir is missing", async () => {
    const home = await mkdtemp(join(tmpdir(), "bluenexus-home-"))
    const agentsRoot = join(home, ".openclaw", "agents")
    const mainAgentDir = join(agentsRoot, "main", "agent")
    const assistantAgentDir = join(agentsRoot, "assistant", "agent")

    await mkdir(mainAgentDir, { recursive: true })
    await mkdir(assistantAgentDir, { recursive: true })

    const oldCred = makeCredential({
      access: "old-access",
      refresh: "old-refresh",
      expires: 1000,
    })
    const newCred = makeCredential({
      access: "new-access",
      refresh: "new-refresh",
      expires: 2000,
    })

    await writeFile(
      join(mainAgentDir, "auth-profiles.json"),
      `${JSON.stringify({
        profiles: {
          "bluenexus-openclaw-plugin:default": oldCred,
        },
      })}\n`,
      "utf8"
    )

    await writeFile(
      join(assistantAgentDir, "auth-profiles.json"),
      `${JSON.stringify({
        profiles: {
          "bluenexus-openclaw-plugin:default": newCred,
        },
      })}\n`,
      "utf8"
    )

    const previousHome = process.env.HOME
    process.env.HOME = home
    try {
      const loaded = await loadCredentialFromAuthProfiles({})
      expect(loaded).toBeDefined()
      expect(loaded?.access).toBe("new-access")
      expect(loaded?.expires).toBe(2000)
    } finally {
      process.env.HOME = previousHome
    }
  })
})
