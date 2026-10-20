import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AuthContext } from '../types.js';

export const layerreAuthStatusTool = {
  name: 'layerre_auth_status',
  description: 'Check authentication status and get current user information',
  inputSchema: z.object({}).strict(),
  handler: async (_args: {}, authContext: AuthContext) => {
    logger.info('Checking auth status', { userId: authContext.userId });

    const isApiKey = authContext.authType === 'api_key';
    const expiresInSeconds = Math.floor((authContext.expiresAt - Date.now()) / 1000);
    const isExpired = expiresInSeconds <= 0;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            authenticated: !isExpired,
            auth_type: authContext.authType,
            user_id: isApiKey ? undefined : authContext.userId,
            expires_in_seconds: isApiKey ? null : Math.max(0, expiresInSeconds),
          }, null, 2),
        },
      ],
    };
  },
};
