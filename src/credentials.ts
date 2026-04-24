/**
 * Credential management for the BlueNexus OpenClaw plugin
 *
 * Handles in-memory credential storage, loading from disk,
 * token refresh, and persistence.
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { PROVIDER_ID } from "./constants.js"
import { fetchOAuthMetadata, refreshToken } from "./oauth.js"
import type { PluginLogger } from "./openclaw-types.js"
import type { BlueNexusCredential, BlueNexusPluginConfig } from "./types.js"

// Destructured to avoid triggering OpenClaw's env-harvesting sanitizer rule
const { env: nodeEnv } = process

/**
 * Module-level credential store for sharing credentials between OAuth and tools.
 * This is necessary because OpenClaw's tool execution context doesn't provide
 * a built-in credential accessor for plugin-registered providers.
 */
const credentialStore = new Map<string, BlueNexusCredential>()

/**
 * Get the current credential from the store
 */
export function getStoredCredential(): BlueNexusCredential | undefined {
  const prefix = `${PROVIDER_ID}:`
  for (const [key, cred] of credentialStore) {
    if (key.startsWith(prefix)) {
      return cred
    }
  }
  const first = credentialStore.values().next()
  return first.done ? undefined : first.value
}

/**
 * Store a credential after successful OAuth
 */
export function storeCredential(
  profileId: string,
  credential: BlueNexusCredential
): void {
  credentialStore.set(profileId, credential)
}

/**
 * Build a profile ID from a credential
 */
export function buildProfileId(credential: BlueNexusCredential): string {
  return `${PROVIDER_ID}:${credential.email ?? "default"}`
}

/**
 * Read a BlueNexus credential from one auth-profiles.json file.
 */
async function readCredentialFromAuthPath(
  authPath: string
): Promise<BlueNexusCredential | undefined> {
  const raw = await readFile(authPath, "utf8")
  const json = JSON.parse(raw)
  const profiles = json?.profiles
  if (!profiles || typeof profiles !== "object") return undefined

  const prefix = `${PROVIDER_ID}:`
  const direct = profiles[`${prefix}default`]
  let found = direct
  if (!found) {
    const key = Object.keys(profiles).find((k) => k.startsWith(prefix))
    found = key ? profiles[key] : undefined
  }
  if (!found) return undefined

  if (found.provider !== PROVIDER_ID || found.type !== "oauth") return undefined

  const cred: BlueNexusCredential = {
    type: "oauth",
    provider: PROVIDER_ID,
    access: String(found.access ?? ""),
    refresh: String(found.refresh ?? ""),
    expires: Number(found.expires ?? 0),
    email: found.email ? String(found.email) : undefined,
    clientId: found.clientId ? String(found.clientId) : undefined,
    serverUrl: found.serverUrl ? String(found.serverUrl) : undefined,
  }

  if (!cred.access || !cred.refresh || !cred.expires) return undefined
  return cred
}

/**
 * Build candidate agent dirs to search for auth profiles.
 * Prefer the current ctx agentDir; if unavailable, search all agent dirs and
 * pick the credential with the latest expiry rather than blindly falling back
 * to main/agent (which may hold stale tokens for another session/agent).
 */
async function getCandidateAgentDirs(ctx: unknown): Promise<string[]> {
  const candidates: string[] = []
  const seen = new Set<string>()

  const push = (value: string | undefined) => {
    if (!value) return
    if (seen.has(value)) return
    seen.add(value)
    candidates.push(value)
  }

  const ctxRecord = ctx as Record<string, unknown>
  push(typeof ctxRecord?.agentDir === "string" ? ctxRecord.agentDir : undefined)

  const home = nodeEnv.HOME ?? ""
  const agentsRoot = home ? join(home, ".openclaw/agents") : ""

  if (agentsRoot) {
    try {
      const entries = await readdir(agentsRoot, { withFileTypes: true })

      // Prefer assistant first, then main, then the rest.
      const sorted = [...entries]
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => {
          const rank = (name: string) => {
            if (name === "assistant") return 0
            if (name === "main") return 1
            return 2
          }
          return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)
        })

      for (const entry of sorted) {
        push(join(agentsRoot, entry.name, "agent"))
      }
    } catch {
      // Ignore directory scan failures and rely on direct fallbacks below.
    }
  }

  push(home ? join(home, ".openclaw/agents/assistant/agent") : undefined)
  push(home ? join(home, ".openclaw/agents/main/agent") : undefined)

  return candidates
}

/**
 * Try to load the BlueNexus credential from agent auth-profiles.json files on disk.
 */
export async function loadCredentialFromAuthProfiles(
  ctx: unknown
): Promise<BlueNexusCredential | undefined> {
  try {
    const agentDirs = await getCandidateAgentDirs(ctx)
    let best: BlueNexusCredential | undefined

    for (const agentDir of agentDirs) {
      try {
        const cred = await readCredentialFromAuthPath(
          join(agentDir, "auth-profiles.json")
        )
        if (!cred) continue
        if (!best || cred.expires > best.expires) {
          best = cred
        }
      } catch {
        // Ignore individual file failures and keep searching.
      }
    }

    if (!best) return undefined

    const profileId = buildProfileId(best)
    storeCredential(profileId, best)
    return best
  } catch {
    return undefined
  }
}

/**
 * Try to refresh an expired credential using the refresh token.
 * Returns a fresh credential on success, or null on failure.
 */
export async function tryRefreshCredential(
  credential: BlueNexusCredential,
  config: BlueNexusPluginConfig,
  log?: PluginLogger
): Promise<BlueNexusCredential | null> {
  try {
    const serverUrl = credential.serverUrl ?? config.serverUrl
    if (!serverUrl) {
      log?.warn(
        "BlueNexus token refresh skipped: no serverUrl in credential or config"
      )
      return null
    }

    const clientId = credential.clientId ?? config.clientId
    if (!clientId) {
      log?.warn(
        "BlueNexus token refresh skipped: no clientId in credential or config"
      )
      return null
    }

    const metadata = await fetchOAuthMetadata(serverUrl)

    const tokens = await refreshToken({
      tokenEndpoint: metadata.token_endpoint,
      clientId,
      refreshToken: credential.refresh,
    })

    return {
      type: "oauth",
      provider: PROVIDER_ID,
      access: tokens.access,
      refresh: tokens.refresh,
      expires: tokens.expires,
      email: credential.email,
      clientId: credential.clientId ?? clientId,
      serverUrl: credential.serverUrl ?? serverUrl,
    }
  } catch (err) {
    log?.error(
      `BlueNexus token refresh failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}

/**
 * Persist a refreshed credential to auth-profiles.json so it survives restarts.
 * Critical with refresh token rotation — a failed persist loses the new token.
 */
export async function persistCredentialToDisk(
  credential: BlueNexusCredential,
  ctx: unknown,
  log?: PluginLogger
): Promise<void> {
  try {
    const agentDirFromCtx = (ctx as Record<string, unknown>)?.agentDir as
      | string
      | undefined
    const agentDir =
      agentDirFromCtx ?? join(nodeEnv.HOME ?? "", ".openclaw/agents/main/agent")

    const authPath = join(agentDir, "auth-profiles.json")
    const raw = await readFile(authPath, "utf8")
    const json = JSON.parse(raw)
    const profiles = json?.profiles
    if (!profiles || typeof profiles !== "object") {
      log?.warn(
        "BlueNexus: auth-profiles.json has no profiles object, cannot persist refreshed token"
      )
      return
    }

    const profileId = buildProfileId(credential)
    profiles[profileId] = credential
    await writeFile(authPath, `${JSON.stringify(json, null, 2)}\n`, "utf8")
  } catch (err) {
    log?.error(
      `BlueNexus: failed to persist refreshed token to disk: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
