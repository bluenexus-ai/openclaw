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

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentToolParams, BlueNexusCredential, BlueNexusPluginConfig } from "./src/types.js";
import { configUiHints, parseConfig } from "./src/config.js";
import { createMcpClient } from "./src/mcp-client.js";
import { fetchOAuthMetadata, loginBlueNexus, refreshToken } from "./src/oauth.js";
import { agentTool, executeAgentTool } from "./src/tools/agent.js";
import { connectionsTool, executeConnectionsTool } from "./src/tools/connections.js";

type PluginLogger = {
  info?: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

/**
 * Module-level credential store for sharing credentials between OAuth and tools.
 * This is necessary because OpenClaw's tool execution context doesn't provide
 * a built-in credential accessor for plugin-registered providers.
 */
const credentialStore = new Map<string, BlueNexusCredential>();

/**
 * Get the current credential from the store
 */
function getStoredCredential(): BlueNexusCredential | undefined {
  // Try to get credential by profile ID patterns
  for (const [key, cred] of credentialStore) {
    if (key.startsWith("bluenexus:")) {
      return cred;
    }
  }
  // Fallback to any credential
  const first = credentialStore.values().next();
  return first.done ? undefined : first.value;
}

/**
 * Try to load the BlueNexus credential from the agent auth-profiles.json on disk.
 *
 * This fixes the current situation where `models auth login --provider bluenexus`
 * correctly writes to auth-profiles.json, but the tools only check an in-memory
 * store.
 */
async function loadCredentialFromAuthProfiles(
  ctx: unknown,
): Promise<BlueNexusCredential | undefined> {
  try {
    const agentDirFromCtx = (ctx as any)?.agentDir as string | undefined;
    const agentDir = agentDirFromCtx ?? join(process.env.HOME ?? "", ".openclaw/agents/main/agent");

    const authPath = join(agentDir, "auth-profiles.json");
    const raw = await readFile(authPath, "utf8");
    const json = JSON.parse(raw);
    const profiles = json?.profiles;
    if (!profiles || typeof profiles !== "object") return undefined;

    // Prefer bluenexus:default; otherwise pick first bluenexus:* profile
    const direct = profiles["bluenexus:default"];
    let found = direct;
    if (!found) {
      const key = Object.keys(profiles).find((k) => k.startsWith("bluenexus:"));
      found = key ? profiles[key] : undefined;
    }
    if (!found) return undefined;

    // Minimal shape check
    if (found.provider !== "bluenexus" || found.type !== "oauth") return undefined;

    const cred: BlueNexusCredential = {
      type: "oauth",
      provider: "bluenexus",
      access: String(found.access ?? ""),
      refresh: String(found.refresh ?? ""),
      expires: Number(found.expires ?? 0),
      email: found.email ? String(found.email) : undefined,
      clientId: found.clientId ? String(found.clientId) : undefined,
      serverUrl: found.serverUrl ? String(found.serverUrl) : undefined,
    };

    if (!cred.access || !cred.refresh || !cred.expires) return undefined;

    const profileId = `bluenexus:${cred.email ?? "default"}`;
    storeCredential(profileId, cred);
    return cred;
  } catch {
    return undefined;
  }
}

/**
 * Store a credential after successful OAuth
 */
function storeCredential(profileId: string, credential: BlueNexusCredential): void {
  credentialStore.set(profileId, credential);
}

/**
 * Try to refresh an expired credential using the refresh token.
 * Returns a fresh credential on success, or null on failure.
 */
async function tryRefreshCredential(
  credential: BlueNexusCredential,
  config: BlueNexusPluginConfig,
  log?: PluginLogger,
): Promise<BlueNexusCredential | null> {
  try {
    const serverUrl = credential.serverUrl ?? config.serverUrl;
    if (!serverUrl) {
      log?.warn("BlueNexus token refresh skipped: no serverUrl in credential or config");
      return null;
    }

    const clientId = credential.clientId ?? config.clientId;
    if (!clientId) {
      log?.warn("BlueNexus token refresh skipped: no clientId in credential or config");
      return null;
    }

    const metadata = await fetchOAuthMetadata(serverUrl);

    const tokens = await refreshToken({
      tokenEndpoint: metadata.token_endpoint,
      clientId,
      refreshToken: credential.refresh,
    });

    return {
      type: "oauth",
      provider: "bluenexus",
      access: tokens.access,
      refresh: tokens.refresh,
      expires: tokens.expires,
      email: credential.email,
      clientId: credential.clientId ?? clientId,
      serverUrl: credential.serverUrl ?? serverUrl,
    };
  } catch (err) {
    log?.error(
      `BlueNexus token refresh failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Persist a refreshed credential to auth-profiles.json so it survives restarts.
 * Critical with refresh token rotation — a failed persist loses the new token.
 */
async function persistCredentialToDisk(
  credential: BlueNexusCredential,
  ctx: unknown,
  log?: PluginLogger,
): Promise<void> {
  try {
    const agentDirFromCtx = (ctx as Record<string, unknown>)?.agentDir as string | undefined;
    const agentDir = agentDirFromCtx ?? join(process.env.HOME ?? "", ".openclaw/agents/main/agent");

    const authPath = join(agentDir, "auth-profiles.json");
    const raw = await readFile(authPath, "utf8");
    const json = JSON.parse(raw);
    const profiles = json?.profiles;
    if (!profiles || typeof profiles !== "object") {
      log?.warn("BlueNexus: auth-profiles.json has no profiles object, cannot persist refreshed token");
      return;
    }

    const profileId = `bluenexus:${credential.email ?? "default"}`;
    profiles[profileId] = credential;
    await writeFile(authPath, JSON.stringify(json, null, 2) + "\n", "utf8");
  } catch (err) {
    // With refresh token rotation, a failed persist means the new token is lost
    // and the old one is already invalidated — the user will need to re-authenticate
    log?.error(
      `BlueNexus: failed to persist refreshed token to disk: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Plugin configuration schema for OpenClaw
 */
const blueNexusConfigSchema = {
  parse(value: unknown): BlueNexusPluginConfig {
    return parseConfig(value);
  },
  uiHints: configUiHints,
};

/**
 * BlueNexus OpenClaw Plugin
 */
const blueNexusPlugin = {
  id: "bluenexus",
  name: "BlueNexus",
  description: "Connect to BlueNexus Universal MCP for access to GitHub, Notion, Slack, and more",
  configSchema: blueNexusConfigSchema,

  register(api: {
    pluginConfig: unknown;
    logger: PluginLogger;
    registerProvider: (provider: {
      id: string;
      label: string;
      docsPath?: string;
      aliases?: string[];
      auth: Array<{
        id: string;
        label: string;
        hint?: string;
        kind: "oauth";
        run: (ctx: {
          isRemote: boolean;
          openUrl: (url: string) => Promise<void>;
          prompter: {
            text: (opts: { message: string }) => Promise<string | symbol>;
            note: (message: string, title?: string) => Promise<void>;
            progress: (msg: string) => {
              update: (msg: string) => void;
              stop: (msg?: string) => void;
            };
          };
          runtime: { log: (msg: string) => void };
        }) => Promise<{
          profiles: Array<{
            profileId: string;
            credential: BlueNexusCredential;
          }>;
          notes?: string[];
        }>;
      }>;
      refreshOAuth?: (credential: BlueNexusCredential) => Promise<BlueNexusCredential>;
    }) => void;
    registerTool: (tool: {
      name: string;
      label: string;
      description: string;
      parameters: unknown;
      execute: (
        toolCallId: string,
        params: unknown,
        ctx: unknown,
      ) => Promise<{
        content: Array<{ type: string; text: string }>;
        details?: unknown;
      }>;
    }) => void;
  }) {
    const config = blueNexusConfigSchema.parse(api.pluginConfig);
    const log = api.logger;

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

              const profileId = `bluenexus:${credential.email ?? "default"}`;

              // Store credential in module-level store for tool access
              storeCredential(profileId, credential);

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
              };
            } catch (err) {
              spin.stop("BlueNexus OAuth failed");
              throw err;
            }
          },
        },
      ],

      // Token refresh handler - kept for forward-compatibility (core may call it)
      async refreshOAuth(credential) {
        const refreshed = await tryRefreshCredential(credential, config, log);
        if (!refreshed) {
          throw new Error("Token refresh failed. Re-authenticate with BlueNexus.");
        }

        const profileId = `bluenexus:${refreshed.email ?? "default"}`;
        storeCredential(profileId, refreshed);

        return refreshed;
      },
    });

    // Register the bluenexus_connections tool
    api.registerTool({
      ...connectionsTool,
      async execute(_toolCallId, _params, _ctx) {
        let credential = getStoredCredential();
        // If missing or expired, reload from disk (models auth login writes there)
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

        // Auto-refresh if token is expired
        if (Date.now() >= credential.expires) {
          const refreshed = await tryRefreshCredential(credential, config, log);
          if (refreshed) {
            const profileId = `bluenexus:${refreshed.email ?? "default"}`;
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

    // Register the bluenexus_agent tool
    api.registerTool({
      ...agentTool,
      async execute(_toolCallId, params, _ctx) {
        let credential = getStoredCredential();
        // If missing or expired, reload from disk (models auth login writes there)
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

        // Auto-refresh if token is expired
        if (Date.now() >= credential.expires) {
          const refreshed = await tryRefreshCredential(credential, config, log);
          if (refreshed) {
            const profileId = `bluenexus:${refreshed.email ?? "default"}`;
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
export type { BlueNexusCredential, BlueNexusPluginConfig } from "./src/types.js";
