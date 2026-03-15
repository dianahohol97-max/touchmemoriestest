// Product custom attribute types

export type AttributeType = 'boolean' | 'select' | 'number' | 'text';

export interface CustomAttribute {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[]; // For select type
  required?: boolean;
  min?: number; // For number type
  max?: number; // For number type
  placeholder?: string; // For text/number type
}

export interface AttributePriceModifiers {
  [key: string]: number; // e.g., "engraving": 150, "paper_type_Глянцевий": 50
}

export interface SelectedAttributes {
  [key: string]: boolean | string | number; // e.g., { "engraving": true, "paper_type": "Глянцевий", "weight": 250 }
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  sku: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  price: number;
  stock: number;
  category_id: string;
  is_active: boolean;
  images: string[];
  variants?: ProductVariant[];
  video_url?: string;
  is_popular?: boolean;
  meta_title?: string;
  meta_description?: string;
  is_personalized?: boolean;
  is_partially_personalized?: boolean;
  track_inventory?: boolean;
  low_stock_threshold?: number;
  cost_price?: number;
  cost_price_currency?: string;
  custom_attributes?: CustomAttribute[];
  characteristics?: any[]; // For dynamic attributes
  options?: any[]; // For product options/variants
  attribute_price_modifiers?: AttributePriceModifiers;
  price_from?: boolean;
  popular_order?: number;
  created_at?: string;
  updated_at?: string;
}
