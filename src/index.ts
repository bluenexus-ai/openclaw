/**
 * BlueNexus OpenClaw Plugin
 *
 * This plugin enables OpenClaw agents to connect to BlueNexus Universal MCP,
 * providing access to connected services like GitHub, Notion, Slack, and more.
 */

import { configUiHints, parseConfig } from "./config.js"
import { PLUGIN_ID, PLUGIN_NAME, PROVIDER_ALIASES, PROVIDER_ID } from "./constants.js"
import { buildProfileId, storeCredential, tryRefreshCredential } from "./credentials.js"
import { loginBlueNexus } from "./oauth.js"
import type { PluginApi } from "./openclaw-types.js"
import { registerListConnectionsTool } from "./tools/list-connections/index.js"
import { registerUseAgentTool } from "./tools/use-agent/index.js"

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
  description: "Connect to BlueNexus Universal MCP for access to GitHub, Notion, Slack, and more",
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
                prompt: async (message) => String(await ctx.prompter.text({ message })),
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
                  "Use use-agent to interact with your connected services.",
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
          throw new Error("Token refresh failed. Re-authenticate with BlueNexus.")
        }

        const profileId = buildProfileId(refreshed)
        storeCredential(profileId, refreshed)

        return refreshed
      },
    })

    // Register tools (self-contained)
    registerListConnectionsTool(api, config)
    registerUseAgentTool(api, config)

    log.info?.("BlueNexus plugin registered")
  },
}

export default blueNexusPlugin

// Re-export types for consumers
export type { BlueNexusCredential, BlueNexusPluginConfig } from "./types.js"
