#!/usr/bin/env node
/**
 * stdio entrypoint for local clients (`npx @layerre/mcp-server`).
 * Authenticates with a Layerre API key from LAYERRE_API_KEY.
 */
process.env.MCP_TRANSPORT = 'stdio';
process.env.LAYERRE_API_URL ||= 'https://api.layerre.com';

const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = await import('./tools/registry.js');
const { logger } = await import('./utils/logger.js');
const { fingerprint } = await import('./auth/verify.js');

const apiKey = process.env.LAYERRE_API_KEY;
if (!apiKey || !apiKey.startsWith('lyr_')) {
  // stdout is the protocol channel; report on stderr.
  console.error('LAYERRE_API_KEY is required (create one at https://layerre.com -> Settings -> API keys).');
  process.exit(1);
}

const server = createMcpServer(
  {
    userId: `key:${fingerprint(apiKey)}`,
    accessToken: apiKey,
    expiresAt: 8640000000000000,
    authType: 'api_key',
  },
  'stdio'
);

await server.connect(new StdioServerTransport());
logger.info('Layerre MCP server running on stdio');

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
