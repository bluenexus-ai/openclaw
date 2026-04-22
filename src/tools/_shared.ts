/**
 * Shared helpers for the BlueNexus MCP tools.
 *
 * Each tool needs to load the stored credential, refresh it if expired, persist
 * the rotated refresh token to disk, and build a connected `McpClient`. This
 * module centralises that flow so individual tool files can stay focused on
 * their own schema and result mapping.
 */

import {
  buildProfileId,
  getStoredCredential,
  loadCredentialFromAuthProfiles,
  persistCredentialToDisk,
  storeCredential,
  tryRefreshCredential,
} from "../credentials.js"
import { type McpClient, createMcpClient } from "../mcp-client.js"
import type { PluginLogger } from "../openclaw-types.js"
import type { BlueNexusPluginConfig } from "../types.js"

const LOGIN_HINT =
  "openclaw models auth login --provider bluenexus-openclaw-plugin"

export const NOT_AUTHENTICATED_MESSAGE = `Not authenticated with BlueNexus. Run: ${LOGIN_HINT}`

export const REFRESH_FAILED_MESSAGE = `BlueNexus token refresh failed. Run: ${LOGIN_HINT}`

export type McpClientResolution =
  | { ok: true; client: McpClient }
  | { ok: false; message: string }

/**
 * Resolve a fresh `McpClient` for the authenticated user, refreshing and
 * persisting the credential when needed. Returns a user-facing message if
 * authentication is missing or refresh fails.
 */
export async function resolveMcpClient(
  config: BlueNexusPluginConfig,
  ctx: unknown,
  log: PluginLogger
): Promise<McpClientResolution> {
  let credential = getStoredCredential()
  if (!credential || Date.now() >= credential.expires) {
    credential = (await loadCredentialFromAuthProfiles(ctx)) ?? credential
  }

  if (!credential) {
    return { ok: false, message: NOT_AUTHENTICATED_MESSAGE }
  }

  if (Date.now() >= credential.expires) {
    const refreshed = await tryRefreshCredential(credential, config, log)
    if (!refreshed) {
      return { ok: false, message: REFRESH_FAILED_MESSAGE }
    }
    const profileId = buildProfileId(refreshed)
    storeCredential(profileId, refreshed)
    await persistCredentialToDisk(refreshed, ctx, log)
    credential = refreshed
  }

  const effectiveConfig = credential.serverUrl
    ? { ...config, serverUrl: credential.serverUrl }
    : config

  return {
    ok: true,
    client: createMcpClient(effectiveConfig, credential.access),
  }
}

/**
 * Build a simple text-only tool result for surfacing an error message.
 */
export function textResult(text: string): {
  content: Array<{ type: "text"; text: string }>
} {
  return { content: [{ type: "text", text }] }
}
