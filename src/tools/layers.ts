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
  text_direction: z.literal('rtl').optional(),
  letter_spacing: z.number().min(-200).max(800).optional(),
  line_spacing: z.number().min(500).max(2500).optional(),
  vertical_align: z.string().optional(),
  img_url: z.string().max(512000).optional(),
  image_fit: z.enum(['cover', 'contain']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  flip_horizontal: z.boolean().optional(),
  flip_vertical: z.boolean().optional(),
}).passthrough();

export const layerreCreateLayerTool = {
  name: 'layerre_create_layer',
  description: 'Create a new layer (text or image) for a template. Layer type is inferred from properties if not specified.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template to add the layer to'),
    name: z.string().max(100).optional().describe('Layer name (default: "New Layer")'),
    layer_type: z.enum(['text', 'image']).optional().describe('Layer type (inferred from properties if not provided)'),
    x: z.number().min(-10000).max(10000).optional().describe('X position in pixels (default: 0)'),
    y: z.number().min(-10000).max(10000).optional().describe('Y position in pixels (default: 0)'),
    properties: layerPropertiesSchema.optional().describe('Layer properties (text, img_url, styling, etc.)'),
  }).strict(),
  handler: async (
    args: {
      template_id: string;
      name?: string;
      layer_type?: 'text' | 'image';
      x?: number;
      y?: number;
      properties?: any;
    },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Creating layer', {
      userId: authContext.userId,
      templateId: args.template_id,
      layerType: args.layer_type,
    });

    try {
      const { template_id, ...layerData } = args;
      const layer = await client.createLayer(template_id, layerData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              layer,
              message: 'Layer created successfully. Preview regeneration running in background.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to create layer', {
          userId: authContext.userId,
          templateId: args.template_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Template not found or you do not have access to it');
        } else if (error.status === 400) {
          throw new Error('Invalid layer data. Ensure properties match the layer type (text or image).');
        }
        throw new Error(`Failed to create layer: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreGetLayerTool = {
  name: 'layerre_get_layer',
  description: 'Get detailed information about a specific layer. Signed URLs are automatically refreshed if expired.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template'),
    layer_id: z.string().uuid().describe('The UUID of the layer to retrieve'),
  }).strict(),
  handler: async (
    args: { template_id: string; layer_id: string },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Getting layer', {
      userId: authContext.userId,
      templateId: args.template_id,
      layerId: args.layer_id,
    });

    try {
      const layer = await client.getLayer(args.template_id, args.layer_id);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(layer, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to get layer', {
          userId: authContext.userId,
          templateId: args.template_id,
          layerId: args.layer_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Layer or template not found');
        }
        throw new Error(`Failed to get layer: ${error.message}`);
      }
      throw error;
    }
  },
};

export const layerreUpdateLayerTool = {
  name: 'layerre_update_layer',
  description: 'Update layer properties like position, text content, image URL, styling, etc. Triggers background preview regeneration.',
  inputSchema: z.object({
    template_id: z.string().uuid().describe('The UUID of the template'),
    layer_id: z.string().uuid().describe('The UUID of the layer to update'),
    name: z.string().max(100).optional().describe('New layer name'),
    x: z.number().min(-10000).max(10000).optional().describe('New X position in pixels'),
    y: z.number().min(-10000).max(10000).optional().describe('New Y position in pixels'),
    position: z.number().int().min(0).max(1999).optional().describe('Z-order position (0=bottom/back, higher=top/front)'),
    properties: layerPropertiesSchema.optional().describe('Updated layer properties'),
  }).strict(),
  handler: async (
    args: {
      template_id: string;
      layer_id: string;
      name?: string;
      x?: number;
      y?: number;
      position?: number;
      properties?: any;
    },
    authContext: AuthContext
  ) => {
    const client = new LayerreApiClient(authContext.accessToken);
    
    logger.info('Updating layer', {
      userId: authContext.userId,
      templateId: args.template_id,
      layerId: args.layer_id,
      updates: Object.keys(args).filter(k => !['template_id', 'layer_id'].includes(k)),
    });

    try {
      const { template_id, layer_id, ...updates } = args;
      const layer = await client.updateLayer(template_id, layer_id, updates);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              layer,
              message: 'Layer updated successfully. Preview regeneration running in background.',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof LayerreApiException) {
        logger.error('Failed to update layer', {
          userId: authContext.userId,
          templateId: args.template_id,
          layerId: args.layer_id,
          status: error.status,
          message: error.message,
        });
        
        if (error.status === 404) {
          throw new Error('Layer or template not found');
        }
        throw new Error(`Failed to update layer: ${error.message}`);
      }
      throw error;
    }
  },
};
