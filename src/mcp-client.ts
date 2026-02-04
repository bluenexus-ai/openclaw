/**
 * MCP client for BlueNexus Universal MCP using the official MCP SDK
 *
 * Uses StreamableHTTPClientTransport for HTTP+SSE communication.
 * Authentication is handled via Bearer token in the Authorization header.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Agent } from "undici"
import { getMcpEndpoint } from "./config.js"
import type { BlueNexusPluginConfig, McpToolResult } from "./types.js"

/**
 * Create a custom fetch function that allows self-signed certificates for localhost
 */
function createCustomFetch(url: URL): typeof fetch {
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1"

  if (isLocalhost && url.protocol === "https:") {
    const agent = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    })

    return (input: string | URL | Request, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        // @ts-expect-error - dispatcher is a valid option for Node.js fetch
        dispatcher: agent,
      })
    }
  }

  return fetch
}

/**
 * MCP client wrapper for BlueNexus
 */
export class McpClient {
  private client: Client
  private transport: StreamableHTTPClientTransport | null = null
  private endpoint: URL
  private accessToken: string
  private connected = false

  constructor(config: BlueNexusPluginConfig, accessToken: string) {
    this.endpoint = new URL(getMcpEndpoint(config.serverUrl))
    this.accessToken = accessToken

    this.client = new Client({
      name: "bluenexus-openclaw-plugin",
      version: "0.1.0",
    })
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    const customFetch = createCustomFetch(this.endpoint)

    this.transport = new StreamableHTTPClientTransport(this.endpoint, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
      fetch: customFetch,
    })

    await this.client.connect(this.transport)
    this.connected = true
  }

  /**
   * Ensure connected before making requests
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect()
    }
  }

  /**
   * Update the access token (e.g., after refresh)
   * Requires reconnection to take effect
   */
  async setAccessToken(token: string): Promise<void> {
    this.accessToken = token
    if (this.connected) {
      await this.close()
      await this.connect()
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpToolResult> {
    await this.ensureConnected()

    const result = await this.client.callTool({
      name,
      arguments: args,
    })

    // Handle both content-based and toolResult-based responses
    if ("content" in result && Array.isArray(result.content)) {
      return {
        content: result.content.map((c) => {
          if (c.type === "text") {
            return { type: "text" as const, text: c.text }
          }
          return { type: "text" as const, text: JSON.stringify(c) }
        }),
        isError: typeof result.isError === "boolean" ? result.isError : false,
        _meta: result._meta as Record<string, unknown> | undefined,
      }
    }

    // Fallback for toolResult format
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      isError: false,
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<
    Array<{
      name: string
      description?: string
      inputSchema?: Record<string, unknown>
    }>
  > {
    await this.ensureConnected()

    const result = await this.client.listTools()
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }))
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connected && this.transport) {
      await this.client.close()
      this.transport = null
      this.connected = false
    }
  }
}

/**
 * Create an MCP client with the given config and access token
 */
export function createMcpClient(
  config: BlueNexusPluginConfig,
  accessToken: string
): McpClient {
  return new McpClient(config, accessToken)
}
