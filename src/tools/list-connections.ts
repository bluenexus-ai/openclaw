/**
 * list-connections tool - List available MCP connections
 *
 * This tool proxies to the BlueNexus Universal MCP's "list-connections" tool
 * to show which services are connected and available for use.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../mcp-client.js"
import type { ListConnectionsResponse } from "../types.js"

/**
 * Tool schema - no parameters required
 */
export const ListConnectionsToolSchema = Type.Object({})

/**
 * Tool metadata
 */
export const listConnectionsTool = {
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

/**
 * Execute the list-connections tool
 */
export async function executeListConnectionsTool(client: McpClient): Promise<{
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
