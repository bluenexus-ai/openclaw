/**
 * bluenexus_agent tool - AI agent for connected services
 *
 * This tool proxies to the BlueNexus Universal MCP's "use-agent" tool
 * to interact with connected services through an AI agent.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../mcp-client.js"
import type { AgentToolParams } from "../types.js"

/**
 * Tool schema with parameters
 */
export const AgentToolSchema = Type.Object({
  prompt: Type.String({
    description: "The prompt/instruction for the BlueNexus AI agent",
  }),
  connector: Type.Optional(
    Type.String({
      description:
        "Optional: Filter to a specific MCP provider (e.g., 'github', 'notion', 'slack')",
    })
  ),
})

/**
 * Tool metadata
 */
export const agentTool = {
  name: "bluenexus_agent",
  label: "BlueNexus Agent",
  description:
    "Use the BlueNexus AI agent to interact with your connected services. The agent can perform tasks across GitHub, Notion, Slack, and other connected platforms. Optionally filter to a specific connection.",
  parameters: AgentToolSchema,
}

/**
 * Execute the agent tool
 */
export async function executeAgentTool(
  client: McpClient,
  params: AgentToolParams
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    // Build arguments for the use-agent tool
    const args: Record<string, unknown> = {
      prompt: params.prompt,
    }

    if (params.connector) {
      args.connector = params.connector
    }

    const result = await client.callTool("use-agent", args)

    // Check for error
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

    // Extract text content from the result
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
