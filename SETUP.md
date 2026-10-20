# Setup & Testing

Architecture: MCP client -> `mcp.layerre.com/mcp` (resource server) -> `api.layerre.com/v1`.
Supabase Auth is the OAuth authorization server. The MCP server never stores tokens.

## A. Supabase configuration (OAuth sign-in)

Your project: `https://dtzpqdilmtbttdrwhboy.supabase.co` (issuer = `.../auth/v1`).

1. **Authentication -> OAuth Server**: enable, Site URL `https://www.layerre.com`, Authorization Path
   `/oauth/consent`, enable **Allow Dynamic OAuth Apps**, save. (Done.)
2. **Authentication -> URL Configuration -> Redirect URLs** (this is where the line goes): add
   `https://www.layerre.com/oauth/consent` (and `http://localhost:3000/oauth/consent` for local dev).
   Needed so Google/Microsoft sign-in can return to the consent page mid-flow.
   MCP-client callback URLs (Cursor, Claude, ...) do **not** go here: they are registered by each client
   through dynamic registration.
3. **Deploy the consent page**: `layerre-landing/src/components/OAuthConsentPage.tsx` (route `/oauth/consent`)
   must be live on www.layerre.com before testing.
4. **Settings -> JWT Keys**: use asymmetric keys (ES256/RS256). If still on the legacy HS256 secret,
   rotate to a new signing key, or set `SUPABASE_JWT_SECRET` on the MCP server (the backend already handles HS256).
5. Verify discovery:
   `curl https://dtzpqdilmtbttdrwhboy.supabase.co/auth/v1/.well-known/openid-configuration`
   (should list `registration_endpoint` when dynamic apps are enabled).

## B. Backend

```bash
cd layerre-backend
poetry lock && poetry install      # pyjwt[crypto] was added for JWKS verification
```
`SUPABASE_URL` must be set (used for the JWKS URL). Deploy the backend change before the MCP server.

## C. Run locally (API-key mode, no Supabase OAuth needed)

```bash
cd layerre-mcp
npm install && npm run build
# stdio:
LAYERRE_API_URL=http://localhost:8000 LAYERRE_API_KEY=lyr_... node dist/index.js
# Inspect it:
npx @modelcontextprotocol/inspector node dist/index.js
```

HTTP mode locally:

```bash
cp .env.example .env   # set LAYERRE_API_URL=http://localhost:8000, MCP_PUBLIC_URL=http://localhost:3000,
                       # AUTH_ISSUER=https://<ref>.supabase.co/auth/v1, ALLOWED_ORIGINS=
npm run dev:http
curl -i -X POST localhost:3000/mcp -H 'content-type: application/json' -d '{}'
#  -> 401 with WWW-Authenticate: Bearer resource_metadata=...
curl localhost:3000/.well-known/oauth-protected-resource
npx @modelcontextprotocol/inspector   # Transport: Streamable HTTP, URL http://localhost:3000/mcp
#  - Header test: Authorization: Bearer lyr_...   - OAuth test: use "Open Auth Settings" in the Inspector
```

Tests: `npm test`, types: `npm run typecheck`.

## D. Deploy `mcp.layerre.com`

1. `docker build -t layerre-mcp . && docker run -d --env-file .env -p 127.0.0.1:3000:3000 layerre-mcp`
   (or `docker-compose up -d`).
2. DNS `mcp` A/CNAME -> host; TLS terminator (nginx/Cloudflare) proxying to :3000.
   Disable proxy response buffering for `/mcp`; set `TRUST_PROXY=true`.
3. Production env: `NODE_ENV=production` (set by the Dockerfile): https URLs only, enforced at boot.
4. Verify: `curl https://mcp.layerre.com/health` and the 401 / `.well-known` checks above.

## E. Test in real clients

- Cursor: `~/.cursor/mcp.json` -> `{ "mcpServers": { "layerre": { "url": "https://mcp.layerre.com/mcp" } } }`, click Connect, sign in.
- Claude Code: `claude mcp add --transport http layerre https://mcp.layerre.com/mcp` then `/mcp`.
- Claude.ai / Desktop: Settings -> Connectors -> Add custom connector -> URL.
- Smoke prompt: "List my Layerre templates, then generate a PNG variant of the first one."
- Negative tests: wrong/expired token -> 401; another user's template id -> "not found"; rapid
  `create_variant` loop -> rate limited; `Origin: https://evil.com` -> 403.

## F. Directory submissions

- **Official MCP Registry** (`registry.modelcontextprotocol.io`): publish `server.json` with `mcp-publisher`.
  The `com.layerre/*` namespace requires DNS or HTTP verification of `layerre.com`; npm package needs
  `mcpName` (already in package.json) and `npm publish --access public`.
- **Anthropic Connectors Directory**: needs public docs, privacy policy, support contact, tool annotations
  (done), OAuth working with Claude callback URLs, and a test account with sample data.
- Also: Cursor MCP directory, Smithery, Glama, PulseMCP, mcp.so (mostly auto-indexed from a public GitHub repo).
