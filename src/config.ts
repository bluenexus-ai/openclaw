/**
 * Configuration validation for the BlueNexus OpenClaw plugin
 */

import { z } from "zod"
import type { BlueNexusPluginConfig } from "./types.js"

/**
 * Zod schema for plugin configuration
 */
export const BlueNexusConfigSchema = z.object({
  serverUrl: z
    .string()
    .url()
    .default(process.env.BLUENEXUS_SERVER_URL ?? "https://api.bluenexus.ai")
    .describe("BlueNexus API server URL"),
  clientId: z
    .string()
    .default("")
    .describe(
      "Fallback OAuth client ID. Leave empty to use Dynamic Client Registration (recommended)."
    ),
  redirectPort: z
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(51122)
    .describe("Local port for OAuth callback server"),
})

/**
 * Parse and validate raw plugin config
 */
export function parseConfig(raw: unknown): BlueNexusPluginConfig {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  return BlueNexusConfigSchema.parse({
    serverUrl: value.serverUrl,
    clientId: value.clientId,
    redirectPort: value.redirectPort,
  })
}

/**
 * Get the MCP endpoint URL from the server URL
 */
export function getMcpEndpoint(serverUrl: string): string {
  const base = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl
  return `${base}/mcp`
}

/**
 * Get the OAuth well-known URL for metadata discovery (RFC 9728)
 */
export function getOAuthWellKnownUrl(serverUrl: string): string {
  const base = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl
  return `${base}/.well-known/oauth-authorization-server`
}

/**
 * UI hints for plugin configuration
 */
export const configUiHints = {
  serverUrl: {
    label: "Server URL",
    help: "BlueNexus API server URL. Default points to production.",
    placeholder: "https://api.bluenexus.ai",
  },
  clientId: {
    label: "Client ID (Optional)",
    help: "Leave empty for automatic registration (DCR). Only set if you have a pre-registered client.",
    advanced: true,
  },
  redirectPort: {
    label: "Redirect Port",
    help: "Local port for OAuth callback. Change if port 51122 is in use.",
    advanced: true,
  },
}
