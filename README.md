# @bluenexus/bluenexus-openclaw-plugin

OpenClaw plugin for [BlueNexus](https://bluenexus.ai) Universal MCP. Connect your OpenClaw agents to GitHub, Notion, Slack, Google, and more through a single plugin.

## Getting Started

```bash
# 1. Install OpenClaw and start the daemon
openclaw onboard --install-daemon

# 2. Install the BlueNexus plugin
openclaw plugins install @bluenexus/bluenexus-openclaw-plugin

# 3. Allow the plugin tools
openclaw config set tools.alsoAllow '["bluenexus-openclaw-plugin"]'

# 4. Restart the gateway to load the plugin
openclaw gateway restart

# 5. Authenticate with your BlueNexus account
openclaw models auth login --provider bluenexus-openclaw-plugin
```

Step 5 opens a browser window for OAuth sign-in. Once complete, the plugin is ready to use.

## Available Tools

### `list-connections`

List all connected services and their status.

```
Which services are connected to my BlueNexus account?
```

### `read-connections`

Delegate a read-only task to the BlueNexus AI agent across any of the user's
connected services.

```
What's on my Google Calendar today?
Search for files about the Q4 project in my Google Drive
Show my recent meeting notes from Fireflies
```

### `write-connections`

Delegate a task that can read, create, update, or delete data in the user's
connected services. Only available to sessions with the
`universal-mcp-read-write` OAuth scope (the plugin requests this scope by
default).

```
Create a GitHub issue about the login bug
Send a Slack message to #engineering with today's standup notes
Schedule a meeting with the team for next Tuesday at 2pm
```

### `search-knowledge-base`

Search, browse, or read pages in the user's compiled knowledge base wiki.
Actions: `search`, `get_page`, `get_index`.

```
What do we know about the Q4 launch plan?
Show the knowledge base table of contents.
```

### `add-to-knowledge-base`

Add documents, artifacts, or conversation context to the user's knowledge
base. A compiler LLM will organize and cross-link the content.

```
Save this report to my knowledge base as "Q2 Marketing Strategy".
```

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

1. Re-authenticate: `openclaw models auth login --provider bluenexus-openclaw-plugin`
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
    ├── _shared.ts                 # Shared auth + MCP client helper
    ├── list-connections/          # list-connections tool
    ├── read-connections/          # read-connections tool
    ├── write-connections/         # write-connections tool
    ├── search-knowledge-base/     # search-knowledge-base tool
    └── add-to-knowledge-base/     # add-to-knowledge-base tool
```

## License

[MIT](LICENSE)
