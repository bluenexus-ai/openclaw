# OpenClaw BlueNexus Plugin

## Project Overview

This is an OpenClaw plugin (`@bluenexus/bluenexus-openclaw-plugin`) that connects OpenClaw agents to the BlueNexus Universal MCP. It exposes five tools (`list-connections`, `read-connections`, `write-connections`, `search-knowledge-base`, `add-to-knowledge-base`) and handles OAuth 2.1 PKCE authentication.

## Architecture

- **Entry point:** `src/index.ts` — registers the plugin, OAuth provider, and tools
- **Tools** are self-contained in `src/tools/{tool-name}/index.ts` — each exports a `register*Tool` function
- **Shared tool helpers** in `src/tools/_shared.ts` — credential resolution, MCP client creation, standard error results
- **Credentials** management is in `src/credentials.ts` — in-memory store + disk persistence
- **OAuth** flow is in `src/oauth.ts` — PKCE, DCR, token refresh
- **Constants** in `src/constants.ts` — plugin ID, provider ID, aliases

## Key Files

- `src/index.ts` — Plugin entry point and registration
- `src/tools/_shared.ts` — Shared auth + client resolution for tools
- `src/tools/list-connections/index.ts` — List available connections
- `src/tools/read-connections/index.ts` — Read-only agent over connected services
- `src/tools/write-connections/index.ts` — Read-write agent over connected services
- `src/tools/search-knowledge-base/index.ts` — Search / read the user's knowledge base wiki
- `src/tools/add-to-knowledge-base/index.ts` — Add documents/artifacts to the knowledge base
- `src/credentials.ts` — Token storage, loading, and refresh
- `src/oauth.ts` — OAuth 2.1 PKCE implementation
- `src/config.ts` — Configuration parsing with Zod
- `src/constants.ts` — Shared constants (plugin ID, provider ID)
- `src/openclaw-types.ts` — OpenClaw plugin API type definitions
- `src/types.ts` — Plugin domain types

## Key Conventions

- Use kebab-case for file and tool names
- Plugin ID is `bluenexus-openclaw-plugin` (matches the npm package `@bluenexus/bluenexus-openclaw-plugin` without the scope/namespace)
- Production server URL: `https://api.bluenexus.ai` (default, not localhost)
- Use `BLUENEXUS_SERVER_URL` env var to override for local development
- Tool names must match the platform: `list-connections`, `read-connections`, `write-connections`, `search-knowledge-base`, `add-to-knowledge-base`
- Agent tools (`read-connections` / `write-connections`) accept only a `prompt` parameter — there is no `connector` filter
- `write-connections` is only exposed on sessions with `universal-mcp-read-write` scope; the plugin requests both scopes so both tools are available
- OAuth scope: `openid profile email account connections universal-mcp-read universal-mcp-read-write llm-all`
- Version is read from `package.json` at runtime (no hardcoded versions)
- Use constants from `src/constants.ts` for `PLUGIN_ID`, `PROVIDER_ID`, etc.

## Development

```bash
pnpm install
pnpm run build.    # build and bundle with esbuild
pnpm run test      # vitest
pnpm run dev       # watch mode
pnpm run check     # biome lint + format + typescript types
```

## Testing

Tests are in `src/` alongside their source. It is using vitest. Run `pnpm test` before committing.

## Adding a New Tool

1. Create `src/tools/{tool-name}/index.ts`
2. Define schema, tool metadata, execute function, and `registerTool` function
3. Use `resolveMcpClient` / `textResult` from `src/tools/_shared.ts` to avoid duplicating the auth+client boilerplate
4. Import and call `registerTool` from `src/index.ts`
5. Add the tool name to the expected list in `src/plugin.test.ts` and a per-tool auth-error test case

## Commit Style

- `type: description` format (lowercase, imperative mood)
- Types: feat, fix, refactor, chore, docs, test
