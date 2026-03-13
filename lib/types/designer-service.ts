export type DesignOccasion =
  | 'wedding'
  | 'birthday'
  | 'travel'
  | 'family'
  | 'baby'
  | 'graduation'
  | 'corporate'
  | 'other';

export type StylePreference =
  | 'minimal'
  | 'bright'
  | 'classic'
  | 'romantic'
  | 'kids';

export type PhotoOrder = 'chronological' | 'random' | 'manual';

export type BriefStatus =
  | 'waiting_brief'
  | 'brief_received'
  | 'ai_processing'
  | 'ai_done'
  | 'in_design'
  | 'sent_for_review'
  | 'revision_requested'
  | 'approved';

export type ClientDecision = 'approved' | 'revision_requested';

export interface PhotoMetadata {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  uploadedAt: string;
  score?: number;
  analysis?: {
    quality_score: number;
    subject_type: string;
    has_faces: boolean;
    face_count: number;
    brightness: string;
    composition: string;
    suggested_layout: string;
    description: string;
  };
}

export interface DesignBrief {
  id: string;
  order_id: string;
  token: string;
  occasion?: DesignOccasion;
  style_preference?: StylePreference;
  important_photos?: string;
  title_text?: string;
  additional_notes?: string;
  photo_order?: PhotoOrder;
  is_gift: boolean;
  photos_count: number;
  photos_folder?: string;
  photos_metadata: PhotoMetadata[];
  status: BriefStatus;
  ai_draft_project_id?: string;
  ai_analysis_result?: any;
  ai_layout_plan?: any;
  ai_error?: string;
  submitted_at?: string;
  ai_processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BriefFormData {
  is_gift: boolean;
  occasion: DesignOccasion;
  style_preference: StylePreference;
  important_photos?: string;
  title_text?: string;
  additional_notes?: string;
  photo_order: PhotoOrder;
}

export interface PageComment {
  page: number;
  text: string;
  timestamp?: string;
}

export interface DesignRevision {
  id: string;
  order_id: string;
  revision_number: number;
  project_id: string;
  client_token: string;
  sent_to_client_at?: string;
  reviewed_at?: string;
  client_decision?: ClientDecision;
  client_comments: PageComment[];
  general_feedback?: string;
  designer_notes?: string;
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIPhotoAnalysis {
  photo_id: string;
  quality_score: number;
  subject_type: 'portrait' | 'landscape' | 'group' | 'object' | 'detail';
  has_faces: boolean;
  face_count: number;
  brightness: 'dark' | 'normal' | 'bright';
  composition: 'centered' | 'rule-of-thirds' | 'off-center';
  suggested_layout: 'full-bleed' | 'two-col' | 'single' | 'collage';
  description: string;
}

export interface AILayoutPage {
  page: number;
  type?: 'title' | 'content';
  template: string;
  photo_ids?: string[];
  text?: string;
  caption?: string;
  layout?: string;
  background_color?: string;
  text_color?: string;
}

export interface AILayoutPlan {
  pages: AILayoutPage[];
  total_pages: number;
  style_applied: StylePreference;
  occasion: DesignOccasion;
}

export interface DesignerOrderSummary {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  format: string;
  page_count: number;
  brief_status: BriefStatus;
  photos_count: number;
  ai_status: 'pending' | 'processing' | 'ready' | 'error';
  assigned_designer_id?: string;
  assigned_designer_name?: string;
  revision_count: number;
  max_free_revisions: number;
  deadline?: string;
  created_at: string;
}
