/**
 * BlueNexus OpenClaw Plugin
 *
 * This plugin enables OpenClaw agents to connect to BlueNexus Universal MCP,
 * providing access to connected services like GitHub, Notion, Slack, and more.
 *
 * Features:
 * - OAuth 2.1 PKCE authentication with BlueNexus
 * - Dynamic Client Registration (DCR) support
 * - AI agent tool for interacting with connected services
 * - Connections listing tool to see available integrations
 */

import { configUiHints, parseConfig } from "./src/config.js"
import { createMcpClient } from "./src/mcp-client.js"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  fetchOAuthMetadata,
  loginBlueNexus,
  refreshToken,
} from "./src/oauth.js"
import { agentTool, executeAgentTool } from "./src/tools/agent.js"
import {
  connectionsTool,
  executeConnectionsTool,
} from "./src/tools/connections.js"
import type {
  AgentToolParams,
  BlueNexusCredential,
  BlueNexusPluginConfig,
} from "./src/types.js"

/**
 * Module-level credential store for sharing credentials between OAuth and tools.
 * This is necessary because OpenClaw's tool execution context doesn't provide
 * a built-in credential accessor for plugin-registered providers.
 */
const credentialStore = new Map<string, BlueNexusCredential>()

/**
 * Get the current credential from the store
 */
function getStoredCredential(): BlueNexusCredential | undefined {
  // Try to get credential by profile ID patterns
  for (const [key, cred] of credentialStore) {
    if (key.startsWith("bluenexus:")) {
      return cred
    }
  }
  // Fallback to any credential
  const first = credentialStore.values().next()
  return first.done ? undefined : first.value
}

/**
 * Try to load the BlueNexus credential from the agent auth-profiles.json on disk.
 *
 * This fixes the current situation where `models auth login --provider bluenexus`
 * correctly writes to auth-profiles.json, but the tools only check an in-memory
 * store.
 */
async function loadCredentialFromAuthProfiles(
  ctx: unknown
): Promise<BlueNexusCredential | undefined> {
  try {
    const agentDirFromCtx = (ctx as any)?.agentDir as string | undefined
    const agentDir =
      agentDirFromCtx ?? join(process.env.HOME ?? "", ".openclaw/agents/main/agent")

    const authPath = join(agentDir, "auth-profiles.json")
    const raw = await readFile(authPath, "utf8")
    const json = JSON.parse(raw)
    const profiles = json?.profiles
    if (!profiles || typeof profiles !== "object") return undefined

    // Prefer bluenexus:default; otherwise pick first bluenexus:* profile
    const direct = profiles["bluenexus:default"]
    let found = direct
    if (!found) {
      const key = Object.keys(profiles).find((k) => k.startsWith("bluenexus:"))
      found = key ? profiles[key] : undefined
    }
    if (!found) return undefined

    // Minimal shape check
    if (found.provider !== "bluenexus" || found.type !== "oauth") return undefined

    const cred: BlueNexusCredential = {
      type: "oauth",
      provider: "bluenexus",
      access: String(found.access ?? ""),
      refresh: String(found.refresh ?? ""),
      expires: Number(found.expires ?? 0),
      email: found.email ? String(found.email) : undefined,
      clientId: found.clientId ? String(found.clientId) : undefined,
    }

    if (!cred.access || !cred.refresh || !cred.expires) return undefined

    const profileId = `bluenexus:${cred.email ?? "default"}`
    storeCredential(profileId, cred)
    return cred
  } catch {
    return undefined
  }
}

/**
 * Store a credential after successful OAuth
 */
function storeCredential(
  profileId: string,
  credential: BlueNexusCredential
): void {
  credentialStore.set(profileId, credential)
}

/**
 * Plugin configuration schema for OpenClaw
 */
const blueNexusConfigSchema = {
  parse(value: unknown): BlueNexusPluginConfig {
    return parseConfig(value)
  },
  uiHints: configUiHints,
}

/**
 * BlueNexus OpenClaw Plugin
 */
const blueNexusPlugin = {
  id: "bluenexus",
  name: "BlueNexus",
  description:
    "Connect to BlueNexus Universal MCP for access to GitHub, Notion, Slack, and more",
  configSchema: blueNexusConfigSchema,

  register(api: {
    pluginConfig: unknown
    logger: {
      info?: (msg: string) => void
      warn: (msg: string) => void
      error: (msg: string) => void
    }
    registerProvider: (provider: {
      id: string
      label: string
      docsPath?: string
      aliases?: string[]
      auth: Array<{
        id: string
        label: string
        hint?: string
        kind: "oauth"
        run: (ctx: {
          isRemote: boolean
          openUrl: (url: string) => Promise<void>
          prompter: {
            text: (opts: { message: string }) => Promise<string | symbol>
            note: (message: string, title?: string) => Promise<void>
            progress: (msg: string) => {
              update: (msg: string) => void
              stop: (msg?: string) => void
            }
          }
          runtime: { log: (msg: string) => void }
        }) => Promise<{
          profiles: Array<{
            profileId: string
            credential: BlueNexusCredential
          }>
          notes?: string[]
        }>
      }>
      refreshOAuth?: (params: {
        credential: BlueNexusCredential
        config: BlueNexusPluginConfig
      }) => Promise<BlueNexusCredential>
    }) => void
    registerTool: (tool: {
      name: string
      label: string
      description: string
      parameters: unknown
      execute: (
        toolCallId: string,
        params: unknown,
        ctx: unknown
      ) => Promise<{
        content: Array<{ type: string; text: string }>
        details?: unknown
      }>
    }) => void
  }) {
    const config = blueNexusConfigSchema.parse(api.pluginConfig)

    // Register the BlueNexus OAuth provider
    api.registerProvider({
      id: "bluenexus",
      label: "BlueNexus",
      docsPath: "/integrations/bluenexus",
      aliases: ["bn"],
      auth: [
        {
          id: "oauth",
          label: "BlueNexus OAuth",
          hint: "OAuth 2.1 PKCE flow with DCR",
          kind: "oauth",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Starting BlueNexus OAuth...")

            try {
              const credential = await loginBlueNexus(config, {
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                prompt: async (message) =>
                  String(await ctx.prompter.text({ message })),
                note: ctx.prompter.note,
                log: (message) => ctx.runtime.log(message),
                progress: spin,
              })

              const profileId = `bluenexus:${credential.email ?? "default"}`

              // Store credential in module-level store for tool access
              storeCredential(profileId, credential)

              return {
                profiles: [
                  {
                    profileId,
                    credential,
                  },
                ],
                notes: [
                  "BlueNexus connected! Use bluenexus_connections to see available services.",
                  "Use bluenexus_agent to interact with your connected services.",
                ],
              }
            } catch (err) {
              spin.stop("BlueNexus OAuth failed")
              throw err
            }
          },
        },
      ],

      // Token refresh handler
      async refreshOAuth({ credential, config: pluginConfig }) {
        const metadata = await fetchOAuthMetadata(pluginConfig.serverUrl)
        // Use stored client ID from credential (DCR), falling back to config
        const clientId = credential.clientId ?? pluginConfig.clientId
        if (!clientId) {
          throw new Error(
            "No client ID available for token refresh. Re-authenticate with BlueNexus."
          )
        }
        const tokens = await refreshToken({
          tokenEndpoint: metadata.token_endpoint,
          clientId,
          refreshToken: credential.refresh,
        })

        const refreshedCredential: BlueNexusCredential = {
          type: "oauth",
          provider: "bluenexus",
          access: tokens.access,
          refresh: tokens.refresh,
          expires: tokens.expires,
          email: credential.email,
          clientId: credential.clientId, // Preserve the stored client ID
        }

        // Update credential in module-level store
        const profileId = `bluenexus:${credential.email ?? "default"}`
        storeCredential(profileId, refreshedCredential)

        return refreshedCredential
      },
    })

    // Register the bluenexus_connections tool
    api.registerTool({
      ...connectionsTool,
      async execute(_toolCallId, _params, _ctx) {
        let credential = getStoredCredential()
        // If missing or expired, reload from disk (models auth login writes there)
        if (!credential || Date.now() >= credential.expires) {
          credential = (await loadCredentialFromAuthProfiles(_ctx)) ?? credential
        }
        if (!credential) {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated with BlueNexus. Run: openclaw auth add bluenexus",
              },
            ],
          }
        }

        // Check if token is expired
        if (Date.now() >= credential.expires) {
          return {
            content: [
              {
                type: "text",
                text: "BlueNexus authentication expired. Run: openclaw auth add bluenexus",
              },
            ],
          }
        }

        const client = createMcpClient(config, credential.access)
        return executeConnectionsTool(client)
      },
    })

    // Register the bluenexus_agent tool
    api.registerTool({
      ...agentTool,
      async execute(_toolCallId, params, _ctx) {
        let credential = getStoredCredential()
        // If missing or expired, reload from disk (models auth login writes there)
        if (!credential || Date.now() >= credential.expires) {
          credential = (await loadCredentialFromAuthProfiles(_ctx)) ?? credential
        }
        if (!credential) {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated with BlueNexus. Run: openclaw auth add bluenexus",
              },
            ],
          }
        }

        // Check if token is expired
        if (Date.now() >= credential.expires) {
          return {
            content: [
              {
                type: "text",
                text: "BlueNexus authentication expired. Run: openclaw auth add bluenexus",
              },
            ],
          }
        }

        const client = createMcpClient(config, credential.access)
        return executeAgentTool(client, params as AgentToolParams)
      },
    })

    api.logger.info?.("BlueNexus plugin registered")
  },
}

export default blueNexusPlugin

// Re-export types for consumers
export type { BlueNexusCredential, BlueNexusPluginConfig } from "./src/types.js"
