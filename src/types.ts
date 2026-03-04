/**
 * Shared TypeScript types for the BlueNexus OpenClaw plugin
 */

/**
 * OAuth token credential stored by OpenClaw
 */
export type BlueNexusCredential = {
  type: "oauth"
  provider: "bluenexus"
  access: string
  refresh: string
  expires: number
  email?: string
  /** OAuth client ID (from DCR or config fallback) - needed for token refresh */
  clientId?: string
  /** Server URL - needed for token refresh to discover OAuth metadata */
  serverUrl?: string
}

/**
 * OAuth metadata from RFC 9728 well-known endpoint
 */
export type OAuthMetadata = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  code_challenge_methods_supported?: string[]
}

/**
 * Token response from OAuth token endpoint
 */
export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

/**
 * MCP connection status
 */
export type McpConnection = {
  slug: string
  label: string
  isActive: boolean
}

/**
 * Response from list-connections tool
 */
export type ListConnectionsResponse = {
  active: string[]
  inactive: string[]
}

/**
 * MCP JSON-RPC 2.0 request
 */
export type JsonRpcRequest = {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: Record<string, unknown>
}

/**
 * MCP JSON-RPC 2.0 response
 */
export type JsonRpcResponse<T = unknown> = {
  jsonrpc: "2.0"
  id: string | number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * MCP tool call result content
 */
export type McpToolContent = {
  type: "text"
  text: string
}

/**
 * MCP tool call result
 */
export type McpToolResult = {
  content: McpToolContent[]
  isError?: boolean
  _meta?: Record<string, unknown>
}

/**
 * Agent tool parameters
 */
export type AgentToolParams = {
  prompt: string
  connector?: string
}

/**
 * Plugin configuration
 */
export type BlueNexusPluginConfig = {
  serverUrl: string
  clientId: string
  redirectPort: number
}
