# BlueNexus OpenClaw Plugin - Development Guide

## Overview

This plugin enables OpenClaw agents to connect to BlueNexus Universal MCP, providing access to connected services like GitHub, Notion, Slack, and more.

## Prerequisites

- Node.js 18+
- pnpm or npm
- OpenClaw CLI installed

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Watch Mode (Development)

```bash
npm run dev
```

## Local Testing with Verdaccio

Verdaccio is a lightweight local npm registry for testing packages before publishing to npm.

### Setup Verdaccio

```bash
# Install Verdaccio globally
npm install -g verdaccio

# Start Verdaccio (runs on http://localhost:4873)
verdaccio

# Register a test user (first time only)
curl -X PUT -H "Content-Type: application/json" \
  -d '{"name":"test","password":"test","email":"test@test.com"}' \
  http://localhost:4873/-/user/org.couchdb.user:test

# Set auth token
npm set //localhost:4873/:_authToken "<token-from-above>"

# Configure npm to use local registry
npm config set registry http://localhost:4873
```

### Publish to Verdaccio

```bash
# Build and publish
npm run build
npm publish --registry http://localhost:4873

# Or bump version and publish
npm version patch --no-git-tag-version
npm run build
npm publish --registry http://localhost:4873
```

### Install Plugin from Verdaccio

```bash
# Install the plugin
openclaw plugins install bluenexus

# Restart gateway to load
openclaw gateway restart

# Verify installation
openclaw plugins list
```

## Plugin Development Workflow

### Quick Iteration Cycle

```bash
# 1. Make code changes
# 2. Bump version, build, and publish
npm version patch --no-git-tag-version && npm run build && npm publish --registry http://localhost:4873

# 3. Reinstall plugin
rm -rf ~/.openclaw/extensions/bluenexus
openclaw plugins install bluenexus
openclaw gateway restart
```

### Using Link Mode (Alternative)

For rapid development without republishing:

```bash
openclaw plugins install --link /path/to/bluenexus
openclaw gateway restart
```

Changes require only a gateway restart (no reinstall needed).

## Authentication

After installing the plugin, authenticate with BlueNexus:

```bash
openclaw models auth login --provider bluenexus
```

## Available Tools

Once authenticated, the plugin provides:

- **bluenexus_connections** - List connected services
- **bluenexus_agent** - Interact with connected services

## Project Structure

```
bluenexus/
├── index.ts              # Plugin entry point
├── openclaw.plugin.json  # Plugin metadata
├── package.json
├── tsconfig.json
└── src/
    ├── config.ts         # Configuration parsing
    ├── mcp-client.ts     # MCP client wrapper
    ├── oauth.ts          # OAuth 2.1 PKCE implementation
    ├── types.ts          # TypeScript types
    └── tools/
        ├── agent.ts      # Agent tool implementation
        └── connections.ts # Connections tool implementation
```

## Configuration

Plugin configuration in `openclaw.plugin.json`:

| Option | Default | Description |
|--------|---------|-------------|
| serverUrl | https://localhost:3000 | BlueNexus API server URL |
| clientId | (empty) | OAuth client ID (optional, uses DCR if empty) |
| redirectPort | 51122 | Local port for OAuth callback |

## Publishing to npm

When ready to publish to the public npm registry:

```bash
# Restore npm to use public registry
npm config set registry https://registry.npmjs.org

# Login to npm
npm login

# Publish
npm publish
```

## Troubleshooting

### Plugin not loading

1. Check plugin is installed: `openclaw plugins list`
2. Restart gateway: `openclaw gateway restart`
3. Check for errors in gateway logs

### Authentication issues

1. Re-authenticate: `openclaw models auth login --provider bluenexus`
2. Check token expiry in `~/.openclaw/agents/main/agent/auth-profiles.json`

### TypeScript build errors

Ensure `tsconfig.json` has `"lib": ["ES2022", "DOM"]` for proper Response type support.
