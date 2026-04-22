/**
 * BlueNexus OpenClaw Plugin
 *
 * This plugin enables OpenClaw agents to connect to BlueNexus Universal MCP,
 * providing access to connected services like GitHub, Notion, Slack, and more,
 * as well as the user's compiled knowledge base wiki.
 */

import { configUiHints, parseConfig } from "./config.js"
import {
  PLUGIN_ID,
  PLUGIN_NAME,
  PROVIDER_ALIASES,
  PROVIDER_ID,
} from "./constants.js"
import {
  buildProfileId,
  storeCredential,
  tryRefreshCredential,
} from "./credentials.js"
import { loginBlueNexus } from "./oauth.js"
import type { PluginApi } from "./openclaw-types.js"
import { registerAddToKnowledgeBaseTool } from "./tools/add-to-knowledge-base/index.js"
import { registerListConnectionsTool } from "./tools/list-connections/index.js"
import { registerReadConnectionsTool } from "./tools/read-connections/index.js"
import { registerSearchKnowledgeBaseTool } from "./tools/search-knowledge-base/index.js"
import { registerWriteConnectionsTool } from "./tools/write-connections/index.js"

/**
 * Plugin configuration schema for OpenClaw
 */
const blueNexusConfigSchema = {
  parse(value: unknown) {
    return parseConfig(value)
  },
  uiHints: configUiHints,
}

/**
 * BlueNexus OpenClaw Plugin
 */
const blueNexusPlugin = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  description:
    "Connect to BlueNexus Universal MCP for access to GitHub, Notion, Slack, and more",
  configSchema: blueNexusConfigSchema,

  register(api: PluginApi) {
    const config = blueNexusConfigSchema.parse(api.pluginConfig)
    const log = api.logger

    // Register the BlueNexus OAuth provider
    api.registerProvider({
      id: PROVIDER_ID,
      label: PLUGIN_NAME,
      docsPath: "/integrations/bluenexus",
      aliases: PROVIDER_ALIASES,
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

              const profileId = buildProfileId(credential)
              storeCredential(profileId, credential)

              return {
                profiles: [{ profileId, credential }],
                notes: [
                  "BlueNexus connected! Use list-connections to see available services.",
                  "Use read-connections or write-connections to delegate tasks to the BlueNexus agent.",
                  "Use search-knowledge-base and add-to-knowledge-base to interact with the user's wiki.",
                ],
              }
            } catch (err) {
              spin.stop("BlueNexus OAuth failed")
              throw err
            }
          },
        },
      ],

      async refreshOAuth(credential) {
        const refreshed = await tryRefreshCredential(credential, config, log)
        if (!refreshed) {
          throw new Error(
            "Token refresh failed. Re-authenticate with BlueNexus."
          )
        }

        const profileId = buildProfileId(refreshed)
        storeCredential(profileId, refreshed)

        return refreshed
      },
    })

    // Register tools (self-contained)
    registerListConnectionsTool(api, config)
    registerReadConnectionsTool(api, config)
    registerWriteConnectionsTool(api, config)
    registerSearchKnowledgeBaseTool(api, config)
    registerAddToKnowledgeBaseTool(api, config)

    log.info?.("BlueNexus plugin registered")
  },
}

export default blueNexusPlugin

// Re-export types for consumers
export type { BlueNexusCredential, BlueNexusPluginConfig } from "./types.js"
