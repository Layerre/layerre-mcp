# Contributing

Thanks for helping improve the Layerre MCP server!

```bash
git clone https://github.com/Layerre/layerre-mcp && cd layerre-mcp
npm install
npm run build
npm run typecheck && npm test
```

Copy `.env.example` to `.env` and fill in local values, including `LAYERRE_API_KEY`. The server reads `.env`.

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

- Tools live in `src/tools/`; register new ones in `src/tools/registry.ts` with a title and
  annotations (`readOnlyHint` / `destructiveHint` / ...). Use strict zod schemas.
- Never log tokens or signed URLs; add tests for new validation rules.

By contributing you agree your contributions are licensed under the MIT License.
