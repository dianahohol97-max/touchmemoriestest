export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_production'
  | 'quality_check'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ProductionQueueItem {
  order_id: string;
  customer_name: string;
  product_title: string;
  page_count: number;
  has_express_tag: boolean;
  is_vip_customer: boolean;
  production_deadline: string;
  priority_score: number;
  manual_priority_override?: number;
  assigned_designer_id?: string;
  assigned_designer_name?: string;
  status: OrderStatus;
  paid_at: string;
  created_at: string;
}

export interface DeadlineCalculationParams {
  paid_at: Date;
  page_count: number;
  has_express_tag: boolean;
  active_orders_count: number;
}

export interface PriorityCalculationParams {
  production_deadline: Date;
  has_express_tag: boolean;
  is_vip_customer: boolean;
  manual_override?: number;
}

export interface AutomationSettings {
  id: string;
  auto_assign_designer: boolean;
  notify_designer_telegram: boolean;
  notify_customer_email: boolean;
  standard_production_days: number;
  express_production_days: number;
  high_volume_threshold: number;
  high_volume_extra_days: number;
  busy_queue_threshold: number;
  busy_queue_extra_days: number;
  express_priority_boost: number;
  vip_priority_boost: number;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  status_trigger: OrderStatus;
  subject: string;
  body: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignerWorkload {
  designer_id: string;
  designer_name: string;
  designer_email: string;
  telegram_chat_id?: string;
  active_orders_count: number;
  total_pages_in_queue: number;
}

export interface StatusChangeNotification {
  order_id: string;
  customer_email: string;
  customer_name: string;
  old_status: OrderStatus;
  new_status: OrderStatus;
  tracking_number?: string;
  tracking_url?: string;
  template_used: string;
}
