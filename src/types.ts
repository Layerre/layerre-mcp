export interface AuthContext {
  /** Supabase user id (JWT) or an opaque `key:<hash>` id for API keys */
  userId: string;
  /** Bearer credential forwarded to the Layerre API. Never log or return this. */
  accessToken: string;
  /** Epoch ms when the credential expires (API keys: far future) */
  expiresAt: number;
  authType: 'oauth' | 'api_key';
  /** OAuth client that obtained the token (if present in the JWT) */
  clientId?: string;
}

export interface LayerreApiError {
  status: number;
  message: string;
  detail?: any;
}

export class LayerreApiException extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: any
  ) {
    super(message);
    this.name = 'LayerreApiException';
  }
}

export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  source_url: string;
  background_color: string;
  page_backgrounds?: Record<string, string>;
  preview_url?: string;
  layers: Layer[];
  created_at: string;
  updated_at: string;
  warnings?: string[];
  variant_count?: number;
  tags: string[];
}

export interface TagCount {
  name: string;
  count: number;
}

export interface Layer {
  id: string;
  template_id: string;
  name: string;
  layer_type: 'text' | 'image';
  x: number;
  y: number;
  position: number;
  properties: FlexibleLayerProperties;
  created_at: string;
  updated_at: string;
}

export interface FlexibleLayerProperties {
  width?: number;
  height?: number;
  color?: string;
  rotation?: number;
  text?: string;
  font_size?: number;
  font_name?: string;
  font_style?: {
    weight?: string;
    italic?: boolean;
    underline?: boolean;
  };
  text_align?: 'left' | 'center' | 'right' | 'justify';
  letter_spacing?: number;
  line_spacing?: number;
  vertical_align?: string;
  img_url?: string;
  image_fit?: 'cover' | 'contain';
  signed_url_expiry?: string;
  opacity?: number;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
}

export interface Variant {
  id: string;
  template_id: string;
  url: string;
  signed_url_expiry?: string;
  width: number;
  height: number;
  overrides: VariantOverride[];
  created_at: string;
  updated_at: string;
  warnings?: string[];
}

export interface VariantOverride {
  layer_id: string;
  x: number;
  y: number;
  properties?: FlexibleLayerProperties;
}
