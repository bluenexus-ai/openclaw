# OpenClaw BlueNexus Plugin

## Project Overview

This is an OpenClaw plugin (`@bluenexus/bluenexus-openclaw-plugin`) that connects OpenClaw agents to the BlueNexus Universal MCP. It provides two tools (`list-connections` and `use-agent`) and handles OAuth 2.1 PKCE authentication.

## Architecture

- **Entry point:** `src/index.ts` — registers the plugin, OAuth provider, and tools
- **Tools** are self-contained in `src/tools/{tool-name}/index.ts` — each exports a `registerTool` function
- **Credentials** management is in `src/credentials.ts` — in-memory store + disk persistence
- **OAuth** flow is in `src/oauth.ts` — PKCE, DCR, token refresh
- **Constants** in `src/constants.ts` — plugin ID, provider ID, aliases

## Key Conventions

- Plugin ID is `bluenexus-openclaw-plugin` (matches the npm package `@bluenexus/bluenexus-openclaw-plugin`)
- Production server URL: `https://api.bluenexus.ai` (default, not localhost)
- Use `BLUENEXUS_SERVER_URL` env var to override for local development
- Tool names must match the platform: `list-connections` and `use-agent`
- The agent tool parameter is `connector` (not `connection`)
- OAuth scope: `openid profile email account connections mcp llm-all`
- Version is read from `package.json` at runtime (no hardcoded versions)

## Development

```bash
pnpm install
pnpm run build
pnpm test          # vitest
pnpm run dev       # watch mode
```

## Testing

Tests are in `src/__tests__/` using vitest. Run `pnpm test` before committing.

## Commit Style

- `type: description` format (lowercase, imperative mood)
- Types: feat, fix, refactor, chore, docs, test
