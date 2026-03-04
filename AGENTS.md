# Agent Guidelines for OpenClaw BlueNexus Plugin

## Project Context

This is an OpenClaw plugin (`@bluenexus/openclaw`) that integrates BlueNexus Universal MCP with OpenClaw agents. The plugin provides OAuth 2.1 authentication and two tools for interacting with connected services.

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

## Important Rules

1. **Plugin ID must remain `bluenexus`** — even though the npm package is `@bluenexus/openclaw`
2. **Default server URL is production** (`https://api.bluenexus.ai`), never localhost
3. **Tool names match the platform** — `list-connections` and `use-agent`, not `bluenexus_connections` / `bluenexus_agent`
4. **Agent tool parameter is `connector`** — not `connection`
5. **No hardcoded versions** — version is read from `package.json` at runtime
6. **Run tests before committing** — `pnpm test`
7. **Use constants** from `src/constants.ts` for `PLUGIN_ID`, `PROVIDER_ID`, etc.

## Adding a New Tool

1. Create `src/tools/{tool-name}/index.ts`
2. Define schema, tool metadata, execute function, and `registerTool` function
3. Import and call `registerTool` from `src/index.ts`
4. Add tests in `src/__tests__/{tool-name}.test.ts`

## Testing

```bash
pnpm test        # run all tests
pnpm test:watch  # watch mode
```
