/**
 * read-connections tool - Read-only agent access to connected services
 *
 * Proxies to the BlueNexus Universal MCP's `read-connections` tool, which
 * delegates a read-only task to an agent that can access the user's
 * connected services and data.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type { AgentToolParams, BlueNexusPluginConfig } from "../../types.js"
import { resolveMcpClient, textResult } from "../_shared.js"

const ReadConnectionsToolSchema = Type.Object({
  prompt: Type.String({
    description: "The prompt/instruction for the BlueNexus AI agent",
  }),
})

const toolDefinition = {
  name: "read-connections",
  label: "Read from Connections",
  description: `Delegates a read-only task to an AI agent that can access the user's connected services and data.

The agent will identify the best service to use for each request. Delegate complete subtasks — it can reason about, filter, and combine data across services, not just retrieve it.

When the user's request involves independent tasks across different services, call this tool multiple times in parallel rather than sequentially — each call executes concurrently for faster results.

Use the \`list-connections\` tool to see which services/connections are available before delegating a task.

Example requests:
- "What's on my personal Google Calendar today?"
- "Show my recent meeting notes from Fireflies"
- "Search for files about the Q4 project in my work Google Drive"`,
  parameters: ReadConnectionsToolSchema,
}

async function execute(
  client: McpClient,
  params: AgentToolParams
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const result = await client.callTool("read-connections", {
      prompt: params.prompt,
    })

    if (result.isError) {
      const errorText = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
      return textResult(errorText || "Agent execution failed")
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
    return textResult(`Error executing agent: ${message}`)
  }
}

export function registerReadConnectionsTool(
  api: PluginApi,
  config: BlueNexusPluginConfig
): void {
  const log = api.logger

  api.registerTool({
    ...toolDefinition,
    async execute(_toolCallId, params, ctx) {
      const resolved = await resolveMcpClient(config, ctx, log)
      if (!resolved.ok) {
        return textResult(resolved.message)
      }
      return execute(resolved.client, params as AgentToolParams)
    },
  })
}
