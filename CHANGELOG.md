# Changelog

## 0.2.0
- Streamable HTTP transport (stateless) with standard MCP OAuth discovery (RFC 9728) via Supabase Auth.
- API key (`lyr_`) bearer auth and stdio mode via `LAYERRE_API_KEY`.
- Tool annotations; new `layerre_create_variants_bulk` tool.
- Security hardening: origin allow-list, rate limits, timeouts, SSRF guard, error sanitisation.

## 0.1.0
- Initial release.
