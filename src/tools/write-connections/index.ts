/**
 * write-connections tool - Read-write agent access to connected services
 *
 * Proxies to the BlueNexus Universal MCP's `write-connections` tool, which
 * delegates a task that can read, create, update, or delete data in the
 * user's connected services. Requires the `universal-mcp-read-write` OAuth
 * scope on the BlueNexus session.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type { AgentToolParams, BlueNexusPluginConfig } from "../../types.js"
import { resolveMcpClient, textResult } from "../_shared.js"

const WriteConnectionsToolSchema = Type.Object({
  prompt: Type.String({
    description: "The prompt/instruction for the BlueNexus AI agent",
  }),
})

const toolDefinition = {
  name: "write-connections",
  label: "Write to Connections",
  description: `Delegates a task that can read, create, update, or delete data in the user's connected services.

The agent will identify the best service to use for each request. It can read data, create resources, send messages, schedule meetings, and coordinate multi-step workflows across services.

Use this tool when the task involves writing data (creating, updating, or deleting). It can also read data as part of a write workflow — there is no need to call read-connections first if the write tool can handle the full task in one call.

When the user's request involves independent tasks across different services, call this tool multiple times in parallel rather than sequentially — each call executes concurrently for faster results.

Use the \`list-connections\` tool to see which services/connections are available before delegating a task.

Example requests:
- "Create a GitHub issue about the login bug"
- "Send a Slack message to #engineering with today's standup notes"
- "Schedule a meeting with the team for next Tuesday at 2pm"`,
  parameters: WriteConnectionsToolSchema,
}

async function execute(
  client: McpClient,
  params: AgentToolParams
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const result = await client.callTool("write-connections", {
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

export function registerWriteConnectionsTool(
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
