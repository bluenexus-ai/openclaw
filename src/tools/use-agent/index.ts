/**
 * use-agent tool - AI agent for connected services
 *
 * This tool proxies to the BlueNexus Universal MCP's "use-agent" tool
 * to interact with connected services through an AI agent.
 */

import { Type } from "@sinclair/typebox"
import {
  buildProfileId,
  getStoredCredential,
  loadCredentialFromAuthProfiles,
  persistCredentialToDisk,
  storeCredential,
  tryRefreshCredential,
} from "../../credentials.js"
import type { McpClient } from "../../mcp-client.js"
import { createMcpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type { AgentToolParams, BlueNexusPluginConfig } from "../../types.js"

const UseAgentToolSchema = Type.Object({
  prompt: Type.String({
    description: "The prompt/instruction for the BlueNexus AI agent",
  }),
  connector: Type.Optional(
    Type.String({
      description:
        "Optional: Filter to a specific MCP provider (e.g., 'github', 'notion', 'slack')",
    }),
  ),
})

const toolDefinition = {
  name: "use-agent",
  label: "Use Agent",
  description: `An agent that can access and use the user's connected services.

The agent can help you:
- Access the user's data across connected services
- Perform actions like creating issues, sending messages, scheduling meetings, depending on the service
- Coordinate tasks that span multiple services
- Process complex request and manipulate intermediate data to only return the most relevant information

The agent will do its best to identify the best service to leverage for each request, but you can also guide it by mentioning the service/connection name in your request or in the optional 'connector' input of this tool.

Use the 'list-connections' tool of this MCP server to see which services/connections are available.

Example requests:
- "What's on my personal Google Calendar today?"
- "Create a GitHub issue about the login bug"
- "Show my recent meeting notes from Fireflies"
- "Search for files about the Q4 project in my work Google Drive"`,
  parameters: UseAgentToolSchema,
}

async function execute(
  client: McpClient,
  params: AgentToolParams,
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const args: Record<string, unknown> = {
      prompt: params.prompt,
    }

    if (params.connector) {
      args.connector = params.connector
    }

    const result = await client.callTool("use-agent", args)

    if (result.isError) {
      const errorText = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: errorText || "Agent execution failed",
          },
        ],
      }
    }

    const text =
      result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "Agent completed without response."

    return {
      content: [{ type: "text", text }],
      details: result._meta,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [
        {
          type: "text",
          text: `Error executing agent: ${message}`,
        },
      ],
    }
  }
}

export function registerUseAgentTool(api: PluginApi, config: BlueNexusPluginConfig): void {
  const log = api.logger

  api.registerTool({
    ...toolDefinition,
    async execute(_toolCallId, params, _ctx) {
      let credential = getStoredCredential()
      if (!credential || Date.now() >= credential.expires) {
        credential = (await loadCredentialFromAuthProfiles(_ctx)) ?? credential
      }
      if (!credential) {
        return {
          content: [
            {
              type: "text",
              text: "Not authenticated with BlueNexus. Run: openclaw models auth login --provider bluenexus-openclaw-plugin",
            },
          ],
        }
      }

      if (Date.now() >= credential.expires) {
        const refreshed = await tryRefreshCredential(credential, config, log)
        if (refreshed) {
          const profileId = buildProfileId(refreshed)
          storeCredential(profileId, refreshed)
          await persistCredentialToDisk(refreshed, _ctx, log)
          credential = refreshed
        } else {
          return {
            content: [
              {
                type: "text",
                text: "BlueNexus token refresh failed. Run: openclaw models auth login --provider bluenexus-openclaw-plugin",
              },
            ],
          }
        }
      }

      const effectiveConfig = credential.serverUrl
        ? { ...config, serverUrl: credential.serverUrl }
        : config
      const client = createMcpClient(effectiveConfig, credential.access)
      return execute(client, params as AgentToolParams)
    },
  })
}
