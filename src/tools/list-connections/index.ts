/**
 * list-connections tool - List available MCP connections
 *
 * This tool proxies to the BlueNexus Universal MCP's "list-connections" tool
 * to show which services are connected and available for use.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type { BlueNexusPluginConfig, ListConnectionsResponse } from "../../types.js"
import {
  buildProfileId,
  getStoredCredential,
  loadCredentialFromAuthProfiles,
  persistCredentialToDisk,
  storeCredential,
  tryRefreshCredential,
} from "../../credentials.js"
import { createMcpClient } from "../../mcp-client.js"

const ListConnectionsToolSchema = Type.Object({})

const toolDefinition = {
  name: "list-connections",
  label: "List Connections",
  description:
    `List all the active connections of the user.

Returns information about:
- Which service/connector is active (e.g., GitHub, Google, Slack, etc.)
- With which account the user is active (e.g., email or username)
- A list of services/connectors the user has not activated yet and are therefore strictly unavailable (if relevant, you can encourage the user to connect more services)

Use this to discover what services/connectors are available before using the BlueNexus agent.`,
  parameters: ListConnectionsToolSchema,
}

async function execute(client: McpClient): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const result = await client.callTool("list-connections", {})

    const text =
      result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "No connection information available."

    const meta = result._meta as ListConnectionsResponse | undefined

    return {
      content: [{ type: "text", text }],
      details: meta
        ? {
            activeConnections: meta.active,
            inactiveConnections: meta.inactive,
          }
        : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [
        {
          type: "text",
          text: `Error listing connections: ${message}`,
        },
      ],
    }
  }
}

export function registerListConnectionsTool(
  api: PluginApi,
  config: BlueNexusPluginConfig,
): void {
  const log = api.logger;

  api.registerTool({
    ...toolDefinition,
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
      return execute(client);
    },
  });
}
