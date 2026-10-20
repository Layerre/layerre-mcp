import { z } from 'zod';
import { LayerreApiClient } from '../client/layerreApiClient.js';
import { logger } from '../utils/logger.js';
import { AuthContext, LayerreApiException } from '../types.js';

const layerPropertiesSchema = z.object({
  width: z.number().min(1).max(10000).optional(),
  height: z.number().min(1).max(10000).optional(),
  color: z.string().max(7).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  text: z.string().max(1000).optional(),
  font_size: z.number().min(1).max(2000).optional(),
  font_name: z.string().max(100).optional(),
  font_style: z.object({
    weight: z.string().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
  }).optional(),
  text_align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  letter_spacing: z.number().min(-200).max(800).optional(),
  line_spacing: z.number().min(500).max(2500).optional(),
  vertical_align: z.string().optional(),
  img_url: z.string().max(512000).optional(),
  image_fit: z.enum(['cover', 'contain']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  flip_horizontal: z.boolean().optional(),
  flip_vertical: z.boolean().optional(),
}).passthrough();

const variantOverrideSchema = z.object({
  layer_id: z.string().uuid().describe('The UUID of the layer to override'),
  x: z.number().min(-10000).max(10000).optional().describe('X position override'),
  y: z.number().min(-10000).max(10000).optional().describe('Y position override'),
  properties: layerPropertiesSchema.optional().describe('Property overrides for this layer'),
}).strict();

export const layerreListVariantsTool = {
  name: 'layerre_list_variants',
  description: 'List all variants for a specific template. Signed URLs are automatically refreshed if expired.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template'),
    skip: z.number().int().min(0).optional().describe('Number of variants to skip for pagination'),
    limit: z.number().int().min(1).max(1000).optional().describe('Maximum number of variants to return (default: 100)'),
  }).strict(),
  handler: async (
    args: { template_id: string; skip?: number; limit?: number },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Listing variants', {
      userId: authContext.userId,
      templateId: args.template_id,
      ...args,
    });

    try {
      const variants = await client.listVariants(args.template_id, {
        skip: args.skip,
        limit: args.limit,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              variants,
              count: variants.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to list variants', {
          userId: authContext.userId,
          templateId: args.template_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        }
        throw new Error(`Failed to list variants: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreGetVariantTool = {
  name: 'layerre_get_variant',
  description: 'Get detailed information about a specific variant. Signed URLs are automatically refreshed if expired.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template'),
    variant_id: z.string().uuid().describe('The UUID of the variant to retrieve'),
  }).strict(),
  handler: async (
    args: { template_id: string; variant_id: string },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Getting variant', {
      userId: authContext.userId,
      templateId: args.template_id,
      variantId: args.variant_id,
    });

    try {
      const variant = await client.getVariant(args.template_id, args.variant_id);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(variant, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to get variant', {
          userId: authContext.userId,
          templateId: args.template_id,
          variantId: args.variant_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Variant or template not found');
        }
        throw new Error(`Failed to get variant: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreCreateVariantTool = {
  name: 'layerre_create_variant',
  description: 'Generate a variant (rendered image) from a template with optional layer overrides. This is an expensive operation that renders the final output.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template to generate from'),
    overrides: z.array(variantOverrideSchema).max(2000).optional().describe('Layer overrides to customize the variant'),
    width: z.number().int().min(1).max(10000).optional().describe('Output width in pixels (defaults to template width)'),
    height: z.number().int().min(1).max(10000).optional().describe('Output height in pixels (defaults to template height)'),
    export_type: z.enum(['png', 'pdf', 'jpeg', 'webp']).optional().describe('Export format (default: png)'),
  }).strict(),
  handler: async (
    args: {
      template_id: string;
      overrides?: Array<{
        layer_id: string;
        x?: number;
        y?: number;
        properties?: any;
      }>;
      width?: number;
      height?: number;
      export_type?: 'png' | 'pdf' | 'jpeg' | 'webp';
    },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Creating variant', {
      userId: authContext.userId,
      templateId: args.template_id,
      overrideCount: args.overrides?.length || 0,
    });

    try {
      const { template_id, ...variantData } = args;
      const variant = await client.createVariant(template_id, variantData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              variant,
              message: 'Variant generated successfully.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to create variant', {
          userId: authContext.userId,
          templateId: args.template_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 403) {
          throw new Error('Plan limit exceeded. Please upgrade your plan to generate more variants.');
        } else if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        } else if (error.status === 400) {
          throw new Error('Invalid variant data. Check that layer IDs exist and are not deleted.');
        }
        throw new Error(`Failed to create variant: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreCreateVariantsBulkTool = {
  name: 'layerre_create_variants_bulk',
  description: 'Generate many variants (rendered images) from one template in a single request, e.g. one per row of data. All items share one export format. Expensive: use sparingly and keep batches small. combine_pdf merges PDF items into one multi-page PDF (Plus plan or above).',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template to generate from'),
    export_type: z.enum(['png', 'pdf', 'jpeg', 'webp']).describe('Export format for every item in the batch'),
    items: z.array(z.object({
      overrides: z.array(variantOverrideSchema).max(2000).optional(),
      width: z.number().int().min(1).max(10000).optional(),
      height: z.number().int().min(1).max(10000).optional(),
      page_number: z.number().int().min(0).max(500).optional().describe('Page index to render (0-based)'),
    }).strict()).min(1).max(25).describe('Variant items to render (max 25 per call)'),
    combine_pdf: z.boolean().optional().describe('Merge all items into one multi-page PDF (export_type must be pdf)'),
  }).strict(),
  handler: async (
    args: {
      template_id: string;
      export_type: 'png' | 'pdf' | 'jpeg' | 'webp';
      items: Array<{ overrides?: any[]; width?: number; height?: number; page_number?: number }>;
      combine_pdf?: boolean;
    },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);

    logger.info('Creating bulk variants', {
      userId: authContext.userId,
      templateId: args.template_id,
      itemCount: args.items.length,
    });

    try {
      const { template_id, ...body } = args;
      const result = await client.createVariantsBulk(template_id, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        if (error.status === 403) {
          throw new Error('Plan limit exceeded or feature not available on your plan.');
        } else if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        } else if (error.status === 400) {
          throw new Error('Invalid bulk variant data. Check layer IDs and that combine_pdf is only used with pdf.');
        }
        throw new Error(`Failed to create variants: ${error.message}`);
      }
      throw error;
    }
  },
};
