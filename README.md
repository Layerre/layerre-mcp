# Layerre MCP Server

[![CI](https://github.com/Layerre/layerre-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Layerre/layerre-mcp/actions)
[![npm](https://img.shields.io/npm/v/@layerre/mcp-server)](https://www.npmjs.com/package/@layerre/mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Layerre](https://layerre.com).
Let your AI assistant turn Canva designs into reusable templates, edit layers, and render
PNG / JPEG / WebP / PDF images from data.

Docs: **[layerre.com/docs/mcp](https://layerre.com/docs/mcp/)**

## Features

- Import a Canva share link as an editable template
- Read and update template layers (text, images, positions, styling)
- Generate image/PDF variants with per-layer overrides, singly or in bulk
- Remote server with browser OAuth sign-in, or API key / local stdio

## Quick start

### Remote server (recommended)

Endpoint: `https://mcp.layerre.com/mcp` (Streamable HTTP, OAuth 2.1 + PKCE).

**Cursor** — `~/.cursor/mcp.json`

```json
{ "mcpServers": { "layerre": { "url": "https://mcp.layerre.com/mcp" } } }
```

**Claude Code**

```bash
claude mcp add --transport http layerre https://mcp.layerre.com/mcp
```

**VS Code** — `.vscode/mcp.json`

```json
{ "servers": { "layerre": { "type": "http", "url": "https://mcp.layerre.com/mcp" } } }
```

**Claude Desktop / Claude.ai** — Settings → Connectors → Add custom connector → `https://mcp.layerre.com/mcp`

**Windsurf** — `~/.codeium/windsurf/mcp_config.json`

```json
{ "mcpServers": { "layerre": { "serverUrl": "https://mcp.layerre.com/mcp" } } }
```

Your client opens a browser window to sign in to Layerre and approve access.

### API key (headless / CI)

Create a key in the Layerre dashboard (Settings → API keys), then:

```json
{
  "mcpServers": {
    "layerre": {
      "url": "https://mcp.layerre.com/mcp",
      "headers": { "Authorization": "Bearer lyr_xxxxxxxx_xxxxxxxx" }
    }
  }
}
```

### Local (stdio)

```json
{
  "mcpServers": {
    "layerre": {
      "command": "npx",
      "args": ["-y", "@layerre/mcp-server"],
      "env": { "LAYERRE_API_KEY": "lyr_xxxxxxxx_xxxxxxxx" }
    }
  }
}
```

## Tools

| Tool | Description | Type |
|------|-------------|------|
| `layerre_auth_status` | Check authentication status | read |
| `layerre_list_templates` | List templates (filter by tag, paginate) | read |
| `layerre_get_template` | Get a template with its layers | read |
| `layerre_list_template_tags` | List tags/folders with counts | read |
| `layerre_create_template` | Create a template from a Canva share URL | write |
| `layerre_update_template` | Update name, size, backgrounds, tags | write |
| `layerre_create_layer` | Add a text or image layer | write |
| `layerre_get_layer` | Get a layer | read |
| `layerre_update_layer` | Update a layer | write |
| `layerre_list_variants` | List generated variants | read |
| `layerre_get_variant` | Get a variant | read |
| `layerre_create_variant` | Render one image/PDF with overrides | write |
| `layerre_create_variants_bulk` | Render up to 25 variants in one call | write |

Example prompts:

- "Import https://www.canva.com/design/... as a Layerre template tagged `social`."
- "Generate a PNG of my 'Event Card' template with the title set to 'Launch Day'."

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Privacy & support

[Privacy policy](https://layerre.com/privacy) · [Terms](https://layerre.com/terms) · hello@layerre.com

## License

[MIT](./LICENSE)
