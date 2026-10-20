# Contributing

Thanks for helping improve the Layerre MCP server!

```bash
git clone https://github.com/Layerre/layerre-mcp && cd layerre-mcp
npm install
npm run typecheck && npm test
```

- Tools live in `src/tools/`; register new ones in `src/tools/registry.ts` with a title and
  annotations (`readOnlyHint` / `destructiveHint` / ...). Use strict zod schemas.
- Keep the safe-write scope: no delete, billing, or API-key tools without discussion.
- Never log tokens or signed URLs; add tests for new validation rules.
- Security issues: see [SECURITY.md](./SECURITY.md) (do not open public issues).

By contributing you agree your contributions are licensed under the MIT License.
