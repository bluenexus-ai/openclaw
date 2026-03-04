/**
 * BlueNexus OpenClaw Plugin
 *
 * This plugin enables OpenClaw agents to connect to BlueNexus Universal MCP,
 * providing access to connected services like GitHub, Notion, Slack, and more.
 */

import type { AgentToolParams } from "./types.js";
import type { PluginApi } from "./openclaw-types.js";
import { PLUGIN_ID, PLUGIN_NAME, PROVIDER_ID, PROVIDER_ALIASES } from "./constants.js";
import { configUiHints, parseConfig } from "./config.js";
import { createMcpClient } from "./mcp-client.js";
import { loginBlueNexus } from "./oauth.js";
import {
  buildProfileId,
  getStoredCredential,
  loadCredentialFromAuthProfiles,
  persistCredentialToDisk,
  storeCredential,
  tryRefreshCredential,
} from "./credentials.js";
import { agentTool, executeAgentTool } from "./tools/agent.js";
import { connectionsTool, executeConnectionsTool } from "./tools/connections.js";

/**
 * Plugin configuration schema for OpenClaw
 */
const blueNexusConfigSchema = {
  parse(value: unknown) {
    return parseConfig(value);
  },
  uiHints: configUiHints,
};

/**
 * BlueNexus OpenClaw Plugin
 */
const blueNexusPlugin = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  description: "Connect to BlueNexus Universal MCP for access to GitHub, Notion, Slack, and more",
  configSchema: blueNexusConfigSchema,

  register(api: PluginApi) {
    const config = blueNexusConfigSchema.parse(api.pluginConfig);
    const log = api.logger;

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
            const spin = ctx.prompter.progress("Starting BlueNexus OAuth...");

            try {
              const credential = await loginBlueNexus(config, {
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                note: ctx.prompter.note,
                log: (message) => ctx.runtime.log(message),
                progress: spin,
              });

              const profileId = buildProfileId(credential);
              storeCredential(profileId, credential);

              return {
                profiles: [{ profileId, credential }],
                notes: [
                  "BlueNexus connected! Use list-connections to see available services.",
                  "Use use-agent to interact with your connected services.",
                ],
              };
            } catch (err) {
              spin.stop("BlueNexus OAuth failed");
              throw err;
            }
          },
        },
      ],

      async refreshOAuth(credential) {
        const refreshed = await tryRefreshCredential(credential, config, log);
        if (!refreshed) {
          throw new Error("Token refresh failed. Re-authenticate with BlueNexus.");
        }

        const profileId = buildProfileId(refreshed);
        storeCredential(profileId, refreshed);

        return refreshed;
      },
    });

    // Register the list-connections tool
    api.registerTool({
      ...connectionsTool,
      async execute(_toolCallId, _params, _ctx) {
        let credential = getStoredCredential();
        if (!credential || Date.now() >= credential.expires) {
          credential = (await loadCredentialFromAuthProfiles(_ctx)) ?? credential;
        }
        if (!credential) {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated with BlueNexus. Run: openclaw models auth login --provider bluenexus",
              },
            ],
          };
        }

        if (Date.now() >= credential.expires) {
          const refreshed = await tryRefreshCredential(credential, config, log);
          if (refreshed) {
            const profileId = buildProfileId(refreshed);
            storeCredential(profileId, refreshed);
            await persistCredentialToDisk(refreshed, _ctx, log);
            credential = refreshed;
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "BlueNexus token refresh failed. Run: openclaw models auth login --provider bluenexus",
                },
              ],
            };
          }
        }

        const client = createMcpClient(config, credential.access);
        return executeConnectionsTool(client);
      },
    });

    // Register the use-agent tool
    api.registerTool({
      ...agentTool,
      async execute(_toolCallId, params, _ctx) {
        let credential = getStoredCredential();
        if (!credential || Date.now() >= credential.expires) {
          credential = (await loadCredentialFromAuthProfiles(_ctx)) ?? credential;
        }
        if (!credential) {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated with BlueNexus. Run: openclaw models auth login --provider bluenexus",
              },
            ],
          };
        }

        if (Date.now() >= credential.expires) {
          const refreshed = await tryRefreshCredential(credential, config, log);
          if (refreshed) {
            const profileId = buildProfileId(refreshed);
            storeCredential(profileId, refreshed);
            await persistCredentialToDisk(refreshed, _ctx, log);
            credential = refreshed;
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "BlueNexus token refresh failed. Run: openclaw models auth login --provider bluenexus",
                },
              ],
            };
          }
        }

        const client = createMcpClient(config, credential.access);
        return executeAgentTool(client, params as AgentToolParams);
      },
    });

    log.info?.("BlueNexus plugin registered");
  },
};

export default blueNexusPlugin;

// Re-export types for consumers
export type { BlueNexusCredential, BlueNexusPluginConfig } from "./types.js";
