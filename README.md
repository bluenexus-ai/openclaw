# @bluenexus/openclaw

OpenClaw plugin for [BlueNexus](https://bluenexus.ai) Universal MCP. Connect your OpenClaw agents to GitHub, Notion, Slack, Google, and 20+ other services through a single plugin.

## Installation

```bash
openclaw plugins install @bluenexus/openclaw
```

## Authentication

After installing, authenticate with your BlueNexus account:

```bash
openclaw models auth login --provider bluenexus
```

This opens a browser window for OAuth sign-in. Once complete, the plugin is ready to use.

## Available Tools

### `list-connections`

List all connected services and their status.

```
Which services are connected to my BlueNexus account?
```

### `use-agent`

Interact with your connected services through the BlueNexus AI agent.

```
Create a GitHub issue about the login bug
What's on my Google Calendar today?
Search for files about the Q4 project in my Google Drive
```

You can optionally specify a `connector` parameter to target a specific service (e.g., `github`, `notion`, `slack`).

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `serverUrl` | `https://api.bluenexus.ai` | BlueNexus API server URL |
| `clientId` | *(empty)* | OAuth client ID (optional, uses DCR if empty) |
| `redirectPort` | `51122` | Local port for OAuth callback |

For local development, set the `BLUENEXUS_SERVER_URL` environment variable to override the default server URL.

## Troubleshooting

### Plugin not loading

1. Verify installation: `openclaw plugins list`
2. Restart gateway: `openclaw gateway restart`
3. Check gateway logs for errors

### Authentication issues

1. Re-authenticate: `openclaw models auth login --provider bluenexus`
2. Check token in `~/.openclaw/agents/main/agent/auth-profiles.json`

---

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
pnpm install
pnpm run build
```

### Watch mode

```bash
pnpm run dev
```

### Testing

```bash
pnpm test
```

### Local plugin development

```bash
# Link mode (changes require only gateway restart)
openclaw plugins install --link /path/to/openclaw
openclaw gateway restart
```

### Project Structure

```
src/
├── index.ts                  # Plugin entry point
├── config.ts                 # Configuration parsing (Zod)
├── constants.ts              # Shared constants
├── credentials.ts            # Credential storage and refresh
├── mcp-client.ts             # MCP SDK client wrapper
├── oauth.ts                  # OAuth 2.1 PKCE implementation
├── openclaw-types.ts         # OpenClaw plugin API types
├── types.ts                  # Plugin domain types
├── __tests__/                # Vitest unit tests
└── tools/
    ├── list-connections/     # list-connections tool
    └── use-agent/            # use-agent tool
```

### Publishing

```bash
pnpm run build
npm publish --access public
```

## License

[MIT](LICENSE)
