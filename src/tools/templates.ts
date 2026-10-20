import { z } from 'zod';
import { LayerreApiClient } from '../client/layerreApiClient.js';
import { logger } from '../utils/logger.js';
import { AuthContext, LayerreApiException } from '../types.js';

const CANVA_HOSTS = ['canva.com', 'canva.link'];
const CANVA_URL_SCHEMA = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') return false;
      const host = u.hostname.toLowerCase();
      return CANVA_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }, 'Must be an https URL on canva.com or canva.link');

const TAG_SCHEMA = z
  .string()
  .max(50)
  .regex(/^[a-z0-9 \-_]+$/, 'Tags must be lowercase alphanumeric with spaces, hyphens, or underscores');

export const layerreListTemplatesTool = {
  name: 'layerre_list_templates',
  description: 'List all templates for the authenticated user. Returns template summaries with optional layer details. Use the tag parameter to filter by folder/tag.',
  inputSchema: z.object({
    skip: z.number().int().min(0).optional().describe('Number of templates to skip for pagination'),
    limit: z.number().int().min(1).max(1000).optional().describe('Maximum number of templates to return (default: 100)'),
    include_layers: z.boolean().optional().describe('Whether to include full layer details (default: false, faster without layers)'),
    tag: z.string().optional().describe('Filter to templates that have this tag (case-insensitive)'),
  }).strict(),
  handler: async (
    args: { skip?: number; limit?: number; include_layers?: boolean; tag?: string },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Listing templates', { userId: authContext.userId, ...args });

    try {
      const templates = await client.listTemplates(args);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              templates,
              count: templates.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to list templates', {
          userId: authContext.userId,
          status: error.status,
          message: error.message,
        });
        throw new Error(`Failed to list templates: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreGetTemplateTool = {
  name: 'layerre_get_template',
  description: 'Get detailed information about a specific template including all its layers. Signed URLs are automatically refreshed if expired.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template to retrieve'),
  }).strict(),
  handler: async (
    args: { template_id: string },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Getting template', { userId: authContext.userId, templateId: args.template_id });

    try {
      const template = await client.getTemplate(args.template_id);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(template, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to get template', {
          userId: authContext.userId,
          templateId: args.template_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        }
        throw new Error(`Failed to get template: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreCreateTemplateTool = {
  name: 'layerre_create_template',
  description: 'Create a new template from a Canva share URL. This will extract layers, dimensions, and other metadata from the Canva design. Note: This is an expensive operation that may take 10-30 seconds.',
  inputSchema: z.object({
    canva_url: CANVA_URL_SCHEMA.describe('Public Canva share URL (must be from canva.com domains)'),
    tags: z.array(TAG_SCHEMA).max(20).optional().describe('Initial tags to apply to this template (e.g. ["campaign", "summer-2026"])'),
  }).strict(),
  handler: async (
    args: { canva_url: string; tags?: string[] },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Creating template from Canva URL', {
      userId: authContext.userId,
      canvaUrl: args.canva_url,
    });

    try {
      const template = await client.createTemplate({ canva_url: args.canva_url, tags: args.tags });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              template,
              message: 'Template created successfully. Preview generation running in background.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to create template', {
          userId: authContext.userId,
          canvaUrl: args.canva_url,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 403) {
          throw new Error('Plan limit exceeded. Please upgrade your plan to create more templates.');
        } else if (error.status === 400) {
          throw new Error('Invalid Canva URL. Ensure the URL is a public share link from Canva and has proper permissions.');
        } else if (error.status === 404) {
          throw new Error('Canva design not found. The URL may be invalid or the design may have been deleted.');
        } else if (error.status === 422) {
          throw new Error('Unsupported Canva design type. Only certain design types can be converted to templates.');
        }
        
        throw new Error(`Failed to create template: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreUpdateTemplateTool = {
  name: 'layerre_update_template',
  description: 'Update template properties like name, dimensions, background color, or tags. Tags use replace semantics — pass the full desired tag list. Changing dimensions or background will regenerate the preview in the background.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template to update'),
    name: z.string().max(100).optional().describe('New template name'),
    width: z.number().int().min(1).max(10000).optional().describe('New template width in pixels'),
    height: z.number().int().min(1).max(10000).optional().describe('New template height in pixels'),
    background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('Background color of the first page (page 0) in hex format (#RRGGBB)'),
    page_backgrounds: z.record(z.string().regex(/^\d+$/), z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional().describe('Per-page background colors to merge, keyed by page index string'),
    tags: z.array(TAG_SCHEMA).max(20).optional().describe('Replace all tags on this template. Pass [] to clear all tags. Omit to leave tags unchanged.'),
  }).strict(),
  handler: async (
    args: {
      template_id: string;
      name?: string;
      width?: number;
      height?: number;
      background_color?: string;
      page_backgrounds?: Record<string, string>;
      tags?: string[];
    },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Updating template', {
      userId: authContext.userId,
      templateId: args.template_id,
      updates: Object.keys(args).filter(k => k !== 'template_id'),
    });

    try {
      const { template_id, ...updates } = args;
      const template = await client.updateTemplate(template_id, updates);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              template,
              message: 'Template updated successfully.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to update template', {
          userId: authContext.userId,
          templateId: args.template_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        }
        throw new Error(`Failed to update template: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreListTemplateTagsTool = {
  name: 'layerre_list_template_tags',
  description: "List all unique tags used across the authenticated user's templates, with counts. Useful for discovering available folders/tags before filtering with layerre_list_templates.",
  inputSchema: z.object({}).strict(),
  handler: async (
    _args: Record<string, never>,
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);

    logger.info('Listing template tags', { userId: authContext.userId });

    try {
      const tags = await client.listTemplateTags();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ tags, count: tags.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to list template tags', {
          userId: authContext.userId,
          status: error.status,
          message: error.message,
        });
        throw new Error(`Failed to list template tags: ${error.message}`);
      }
      throw error;
    }
  },
};
