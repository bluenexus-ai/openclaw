/**
 * add-to-knowledge-base tool - Add documents to the user's knowledge base
 *
 * Proxies to the BlueNexus Universal MCP's `add-to-knowledge-base` tool so
 * OpenClaw agents can capture documents, artifacts, and conversation
 * context in the user's persistent, shared wiki.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type {
  AddToKnowledgeBaseParams,
  BlueNexusPluginConfig,
} from "../../types.js"
import { resolveMcpClient, textResult } from "../_shared.js"

const AddToKnowledgeBaseToolSchema = Type.Object({
  name: Type.String({
    description:
      "A clear, descriptive name for the document (e.g., 'Q2 Marketing Strategy', 'API Integration Guide', 'Meeting Notes 2026-04-15')",
  }),
  content: Type.String({
    description:
      "The full document content in markdown format. Include all relevant information — the compiler will organize it.",
  }),
  source_type: Type.Optional(
    Type.Union([Type.Literal("text"), Type.Literal("url")], {
      description:
        "The type of source: 'text' for document content (default), 'url' for a webpage to fetch and process.",
    })
  ),
  url: Type.Optional(
    Type.String({
      description:
        "When source_type is 'url', provide the URL to fetch and add to the knowledge base.",
    })
  ),
  tags: Type.Optional(
    Type.String({
      description:
        "Optional comma-separated tags to help categorize the content (e.g., 'marketing, strategy, q2').",
    })
  ),
})

const toolDefinition = {
  name: "add-to-knowledge-base",
  label: "Add Document to Knowledge Base",
  description: `Add a document, file content, artifact, or any piece of information to the user's knowledge base.

The knowledge base is a persistent, shared wiki that all of the user's AI agents can access. Content added here will be compiled by a dedicated AI into structured, cross-linked wiki pages that the user and their agents can search and reference.

**You should use this tool proactively and generously.** Any content that could be useful in the future should be added:

- Documents or files the user shares with you
- Artifacts you generate (code, reports, analyses, summaries)
- Important decisions or context from your conversation
- Research findings, data, or reference material
- Meeting notes, action items, or project plans
- Any information the user asks you to remember or save

Every piece of content added makes the knowledge base more comprehensive. When in doubt, add it — the compilation system will organize and deduplicate automatically.

Provide a clear, descriptive name for each document so it can be easily found later.`,
  parameters: AddToKnowledgeBaseToolSchema,
}

async function execute(
  client: McpClient,
  params: AddToKnowledgeBaseParams
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const args: Record<string, unknown> = {
      name: params.name,
      content: params.content,
    }
    if (params.source_type) args.source_type = params.source_type
    if (params.url) args.url = params.url
    if (params.tags) args.tags = params.tags

    const result = await client.callTool("add-to-knowledge-base", args)

    if (result.isError) {
      const errorText = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
      return textResult(errorText || "Failed to add document to knowledge base")
    }

    const text =
      result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "Document added to the knowledge base."

    return {
      content: [{ type: "text", text }],
      details: result._meta,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return textResult(`Error adding to knowledge base: ${message}`)
  }
}

export function registerAddToKnowledgeBaseTool(
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
      return execute(resolved.client, params as AddToKnowledgeBaseParams)
    },
  })
}
