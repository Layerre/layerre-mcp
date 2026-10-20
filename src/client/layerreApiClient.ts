import { appConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  LayerreApiException,
  Template,
  TagCount,
  Layer,
  Variant,
  FlexibleLayerProperties,
  VariantOverride,
} from '../types.js';

export interface CreateTemplateRequest {
  canva_url: string;
  tags?: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  width?: number;
  height?: number;
  background_color?: string;
  page_backgrounds?: Record<string, string>;
  tags?: string[];
}

export interface CreateLayerRequest {
  name?: string;
  layer_type?: 'text' | 'image';
  x?: number;
  y?: number;
  properties?: FlexibleLayerProperties;
}

export interface UpdateLayerRequest {
  name?: string;
  x?: number;
  y?: number;
  position?: number;
  properties?: FlexibleLayerProperties;
}

export interface CreateVariantRequest {
  overrides?: Array<{
    layer_id: string;
    x?: number;
    y?: number;
    properties?: FlexibleLayerProperties;
  }>;
  width?: number;
  height?: number;
  export_type?: 'png' | 'pdf' | 'jpeg' | 'webp';
}

export interface CreateVariantsBulkRequest {
  export_type: 'png' | 'pdf' | 'jpeg' | 'webp';
  items: Array<{
    overrides?: CreateVariantRequest['overrides'];
    width?: number;
    height?: number;
    page_number?: number;
  }>;
  combine_pdf?: boolean;
}

export class LayerreApiClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken: string) {
    this.baseUrl = appConfig.layerreApiUrl;
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
    slow = false
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      redirect: 'error', // never follow redirects with the bearer token attached
      signal: AbortSignal.timeout(
        slow ? appConfig.backendSlowTimeoutMs : appConfig.backendTimeoutMs
      ),
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    logger.debug('API Request', { method, path, hasBody: !!body });

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail;
        try {
          errorDetail = JSON.parse(errorText);
        } catch {
          errorDetail = errorText;
        }

        logger.error('API Error', {
          status: response.status,
          statusText: response.statusText,
          detail: errorDetail,
          path,
        });

        throw new LayerreApiException(
          response.status,
          `API request failed: ${response.statusText}`,
          errorDetail
        );
      }

      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof LayerreApiException) {
        throw error;
      }

      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      logger.error('Network Error', { path, timedOut });
      throw new LayerreApiException(
        timedOut ? 504 : 502,
        timedOut ? 'Layerre API timed out' : 'Network error communicating with Layerre API'
      );
    }
  }

  async listTemplates(params?: {
    skip?: number;
    limit?: number;
    include_layers?: boolean;
    tag?: string;
  }): Promise<Template[]> {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());
    if (params?.include_layers !== undefined) queryParams.set('include_layers', params.include_layers.toString());
    if (params?.tag) queryParams.set('tag', params.tag);

    const query = queryParams.toString();
    const path = `/v1/templates${query ? `?${query}` : ''}`;

    return this.makeRequest<Template[]>('GET', path);
  }

  async listTemplateTags(): Promise<TagCount[]> {
    return this.makeRequest<TagCount[]>('GET', '/v1/templates/tags');
  }

  async getTemplate(templateId: string): Promise<Template> {
    return this.makeRequest<Template>('GET', `/v1/template/${templateId}`);
  }

  async createTemplate(request: CreateTemplateRequest): Promise<Template> {
    return this.makeRequest<Template>('POST', '/v1/template', request, true);
  }

  async updateTemplate(
    templateId: string,
    request: UpdateTemplateRequest
  ): Promise<Template> {
    return this.makeRequest<Template>('PATCH', `/v1/template/${templateId}`, request);
  }

  async createLayer(
    templateId: string,
    request: CreateLayerRequest
  ): Promise<Layer> {
    return this.makeRequest<Layer>('POST', `/v1/template/${templateId}/layer`, request);
  }

  async getLayer(templateId: string, layerId: string): Promise<Layer> {
    return this.makeRequest<Layer>('GET', `/v1/template/${templateId}/layer/${layerId}`);
  }

  async updateLayer(
    templateId: string,
    layerId: string,
    request: UpdateLayerRequest
  ): Promise<Layer> {
    return this.makeRequest<Layer>(
      'PATCH',
      `/v1/template/${templateId}/layer/${layerId}`,
      request
    );
  }

  async listVariants(
    templateId: string,
    params?: { skip?: number; limit?: number }
  ): Promise<Variant[]> {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());

    const query = queryParams.toString();
    const path = `/v1/template/${templateId}/variants${query ? `?${query}` : ''}`;

    return this.makeRequest<Variant[]>('GET', path);
  }

  async getVariant(templateId: string, variantId: string): Promise<Variant> {
    return this.makeRequest<Variant>(
      'GET',
      `/v1/template/${templateId}/variant/${variantId}`
    );
  }

  async createVariant(
    templateId: string,
    request: CreateVariantRequest
  ): Promise<Variant> {
    return this.makeRequest<Variant>(
      'POST',
      `/v1/template/${templateId}/variant`,
      request,
      true
    );
  }

  async createVariantsBulk(
    templateId: string,
    request: CreateVariantsBulkRequest
  ): Promise<unknown> {
    return this.makeRequest<unknown>(
      'POST',
      `/v1/template/${templateId}/variant/bulk`,
      request,
      true
    );
  }
}
