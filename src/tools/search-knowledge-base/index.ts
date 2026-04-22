/**
 * search-knowledge-base tool - Search and read the user's knowledge base
 *
 * Proxies to the BlueNexus Universal MCP's `search-knowledge-base` tool,
 * providing three actions against the compiled wiki: `search`, `get_page`,
 * and `get_index`.
 */

import { Type } from "@sinclair/typebox"
import type { McpClient } from "../../mcp-client.js"
import type { PluginApi } from "../../openclaw-types.js"
import type {
  BlueNexusPluginConfig,
  SearchKnowledgeBaseParams,
} from "../../types.js"
import { resolveMcpClient, textResult } from "../_shared.js"

const SearchKnowledgeBaseToolSchema = Type.Object({
  action: Type.Union(
    [
      Type.Literal("search"),
      Type.Literal("get_page"),
      Type.Literal("get_index"),
    ],
    {
      description:
        "The action to perform: 'search' to find pages, 'get_page' to read a specific page, 'get_index' to read the table of contents.",
    }
  ),
  query: Type.Optional(
    Type.String({
      description:
        "Search query — use keywords, not full sentences. Required for 'search' action.",
    })
  ),
  slug: Type.Optional(
    Type.String({
      description: "Page slug to read. Required for 'get_page' action.",
    })
  ),
})

const toolDefinition = {
  name: "search-knowledge-base",
  label: "Search Knowledge Base",
  description: `Search and read the user's knowledge base wiki.

The knowledge base is a persistent, shared wiki compiled from the user's documents, conversations, and data. Use this tool to find information before asking the user — the answer may already be in their knowledge base.

**Actions:**
- \`search\` — Find pages matching a keyword query. Returns page titles, slugs, and content snippets.
- \`get_page\` — Read the full content of a specific wiki page by its slug.
- \`get_index\` — Read the table of contents listing all pages with one-line summaries. Start here to understand what's in the knowledge base.

**Tips:**
- Call \`get_index\` first to see what topics are covered
- Use \`search\` with specific keywords, not full sentences
- Call \`get_page\` to read the full content once you find a relevant page
- Pages may contain \`[[wiki-links]]\` to related pages — follow them for more context`,
  parameters: SearchKnowledgeBaseToolSchema,
}

async function execute(
  client: McpClient,
  params: SearchKnowledgeBaseParams
): Promise<{
  content: Array<{ type: "text"; text: string }>
  details?: unknown
}> {
  try {
    const args: Record<string, unknown> = {
      action: params.action,
    }
    if (params.query) args.query = params.query
    if (params.slug) args.slug = params.slug

    const result = await client.callTool("search-knowledge-base", args)

    if (result.isError) {
      const errorText = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
      return textResult(errorText || "Knowledge base query failed")
    }

    const text =
      result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "Knowledge base returned no content."

    return {
      content: [{ type: "text", text }],
      details: result._meta,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return textResult(`Error querying knowledge base: ${message}`)
  }
}

export function registerSearchKnowledgeBaseTool(
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
      return execute(resolved.client, params as SearchKnowledgeBaseParams)
    },
  })
}
