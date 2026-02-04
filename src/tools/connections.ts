/**
 * bluenexus_connections tool - List available MCP connections
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
export const ConnectionsToolSchema = Type.Object({})

/**
 * Tool metadata
 */
export const connectionsTool = {
  name: "bluenexus_connections",
  label: "BlueNexus Connections",
  description:
    "List available BlueNexus MCP connections. Shows which services (GitHub, Notion, Slack, etc.) are connected and ready to use, and which need to be connected.",
  parameters: ConnectionsToolSchema,
}

/**
 * Execute the connections tool
 */
export async function executeConnectionsTool(client: McpClient): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const result = await client.callTool("list-connections", {})

    // Extract text content from the result
    const text =
      result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "No connection information available."

    // Extract metadata if present
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
