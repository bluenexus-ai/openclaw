# OpenClaw BlueNexus Plugin

## Project Overview

This is an OpenClaw plugin (`@bluenexus/bluenexus-openclaw-plugin`) that connects OpenClaw agents to the BlueNexus Universal MCP. It provides two tools (`list-connections` and `use-agent`) and handles OAuth 2.1 PKCE authentication.

## Architecture

- **Entry point:** `src/index.ts` — registers the plugin, OAuth provider, and tools
- **Tools** are self-contained in `src/tools/{tool-name}/index.ts` — each exports a `registerTool` function
- **Credentials** management is in `src/credentials.ts` — in-memory store + disk persistence
- **OAuth** flow is in `src/oauth.ts` — PKCE, DCR, token refresh
- **Constants** in `src/constants.ts` — plugin ID, provider ID, aliases

## Key Files

- `src/index.ts` — Plugin entry point and registration
- `src/tools/list-connections/index.ts` — List available connections
- `src/tools/use-agent/index.ts` — AI agent for connected services
- `src/credentials.ts` — Token storage, loading, and refresh
- `src/oauth.ts` — OAuth 2.1 PKCE implementation
- `src/config.ts` — Configuration parsing with Zod
- `src/constants.ts` — Shared constants (plugin ID, provider ID)
- `src/openclaw-types.ts` — OpenClaw plugin API type definitions
- `src/types.ts` — Plugin domain types

## Key Conventions

- Use kebab-case for file names
- Plugin ID is `bluenexus-openclaw-plugin` (matches the npm package `@bluenexus/bluenexus-openclaw-plugin` without the scope/namespace)
- Production server URL: `https://api.bluenexus.ai` (default, not localhost)
- Use `BLUENEXUS_SERVER_URL` env var to override for local development
- Tool names must match the platform: `list-connections` and `use-agent`
- The agent tool parameter is `connector` (not `connection`)
- OAuth scope: `openid profile email account connections mcp llm-all`
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
3. Import and call `registerTool` from `src/index.ts`
4. Add unit tests a test file.

## Commit Style

- `type: description` format (lowercase, imperative mood)
- Types: feat, fix, refactor, chore, docs, test
