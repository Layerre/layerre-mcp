import { describe, it, expect } from 'vitest';
import {
  layerreListTemplatesTool,
  layerreGetTemplateTool,
  layerreCreateTemplateTool,
  layerreUpdateTemplateTool,
} from '../src/tools/templates.js';

describe('Template Tools - Schema Validation', () => {
  describe('layerre_list_templates', () => {
    it('should validate pagination params', () => {
      expect(() => {
        layerreListTemplatesTool.inputSchema.parse({ skip: -1 });
      }).toThrow();

      expect(() => {
        layerreListTemplatesTool.inputSchema.parse({ limit: 2000 });
      }).toThrow();

      const valid = layerreListTemplatesTool.inputSchema.parse({
        skip: 0,
        limit: 100,
        include_layers: true,
      });
      expect(valid.skip).toBe(0);
      expect(valid.limit).toBe(100);
    });

    it('should reject unknown fields', () => {
      expect(() => {
        layerreListTemplatesTool.inputSchema.parse({ unknown_field: 'test' });
      }).toThrow();
    });
  });

  describe('layerre_get_template', () => {
    it('should validate UUID format', () => {
      expect(() => {
        layerreGetTemplateTool.inputSchema.parse({ template_id: 'invalid-uuid' });
      }).toThrow();

      const valid = layerreGetTemplateTool.inputSchema.parse({
        template_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(valid.template_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('layerre_create_template', () => {
    it('should validate Canva URL', () => {
      expect(() => {
        layerreCreateTemplateTool.inputSchema.parse({ canva_url: 'not-a-url' });
      }).toThrow();

      const valid = layerreCreateTemplateTool.inputSchema.parse({
        canva_url: 'https://www.canva.com/design/abc123',
      });
      expect(valid.canva_url).toBe('https://www.canva.com/design/abc123');
    });
  });

  describe('layerre_update_template', () => {
    it('should validate update fields', () => {
      const valid = layerreUpdateTemplateTool.inputSchema.parse({
        template_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'New Name',
        width: 1920,
        height: 1080,
        background_color: '#FF0000',
      });
      
      expect(valid.name).toBe('New Name');
      expect(valid.background_color).toBe('#FF0000');
    });

    it('should validate background color format', () => {
      expect(() => {
        layerreUpdateTemplateTool.inputSchema.parse({
          template_id: '123e4567-e89b-12d3-a456-426614174000',
          background_color: 'red',
        });
      }).toThrow();

      expect(() => {
        layerreUpdateTemplateTool.inputSchema.parse({
          template_id: '123e4567-e89b-12d3-a456-426614174000',
          background_color: '#GGGGGG',
        });
      }).toThrow();
    });

    it('should validate dimension bounds', () => {
      expect(() => {
        layerreUpdateTemplateTool.inputSchema.parse({
          template_id: '123e4567-e89b-12d3-a456-426614174000',
          width: 0,
        });
      }).toThrow();

      expect(() => {
        layerreUpdateTemplateTool.inputSchema.parse({
          template_id: '123e4567-e89b-12d3-a456-426614174000',
          width: 20000,
        });
      }).toThrow();
    });
  });
});


describe('create_template SSRF guard', () => {
  it('only accepts https canva.com / canva.link URLs', () => {
    const ok = (u: string) => layerreCreateTemplateTool.inputSchema.safeParse({ canva_url: u }).success;
    expect(ok('https://www.canva.com/design/DAF/abc/view')).toBe(true);
    expect(ok('https://canva.link/xyz')).toBe(true);
    expect(ok('http://www.canva.com/design/x')).toBe(false);
    expect(ok('https://evil.com/?u=canva.com')).toBe(false);
    expect(ok('https://canva.com.evil.com/x')).toBe(false);
    expect(ok('http://169.254.169.254/')).toBe(false);
  });
});
