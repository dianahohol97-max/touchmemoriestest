import { getAdminClient } from '@/lib/supabase/admin';
import { getResendClient } from '@/lib/email/resend';
import type { OrderStatus, EmailTemplate, StatusChangeNotification } from '@/lib/types/automation';

// All DB writes/reads in this module are backend-side automation logic that
// runs without an admin session (status-change webhooks, payment processors).
// We bypass RLS via the service-role admin client; the routes that call into
// this module are responsible for authenticating their callers.



/**
 * Get email template for a status
 */
export async function getEmailTemplate(status: OrderStatus): Promise<EmailTemplate | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('status_trigger', status)
    .eq('enabled', true)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Send order status change notification to customer
 */
export async function sendStatusChangeNotification(params: {
  orderId: string;
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  productTitle: string;
  newStatus: OrderStatus;
  oldStatus: OrderStatus;
  productionDeadline?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if automation is enabled
    const supabase = getAdminClient();
    const { data: settings } = await supabase
      .from('automation_settings')
      .select('notify_customer_email')
      .single();

    if (!settings?.notify_customer_email) {
      return {
        success: false,
        error: 'Email notifications are disabled',
      };
    }

    // Get template for new status
    const template = await getEmailTemplate(params.newStatus);

    if (!template) {
      return {
        success: false,
        error: `No template found for status: ${params.newStatus}`,
      };
    }

    // Prepare template variables
    const variables: Record<string, string> = {
      customer_name: params.customerName,
      order_number: params.orderNumber,
      product_title: params.productTitle,
      production_deadline: params.productionDeadline || '',
      tracking_number: params.trackingNumber || '',
      tracking_url: params.trackingUrl || '',
    };

    // Replace variables in subject and body
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);

    // Send email via Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'TouchMemories <noreply@touchmemories.com>',
      to: params.customerEmail,
      subject,
      text: body,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Log notification
    await logNotification({
      order_id: params.orderId,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
      old_status: params.oldStatus,
      new_status: params.newStatus,
      tracking_number: params.trackingNumber,
      tracking_url: params.trackingUrl,
      template_used: template.id,
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Log notification in database for tracking
 */
async function logNotification(notification: StatusChangeNotification): Promise<void> {
  const supabase = getAdminClient();

  await supabase.from('notification_log').insert({
    order_id: notification.order_id,
    customer_email: notification.customer_email,
    customer_name: notification.customer_name,
    old_status: notification.old_status,
    new_status: notification.new_status,
    tracking_number: notification.tracking_number,
    tracking_url: notification.tracking_url,
    template_id: notification.template_used,
    sent_at: new Date().toISOString(),
  });
}

/**
 * Get all email templates
 */
export async function getAllEmailTemplates(): Promise<EmailTemplate[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('status_trigger');

  if (error) throw error;
  return data || [];
}

/**
 * Update email template
 */
export async function updateEmailTemplate(
  id: string,
  updates: Partial<EmailTemplate>
): Promise<EmailTemplate> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle email template enabled status
 */
export async function toggleEmailTemplate(id: string, enabled: boolean): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('email_templates')
    .update({ enabled })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Preview email with sample data
 */
export function previewEmail(template: EmailTemplate): {
  subject: string;
  body: string;
} {
  const sampleVariables = {
    customer_name: 'Олена Коваленко',
    order_number: 'TM-2024-001',
    product_title: 'Фотокнига "Весільний Альбом" (30x30см, 40 сторінок)',
    production_deadline: '15 березня 2024 р.',
    tracking_number: '59000123456789',
    tracking_url: 'https://novaposhta.ua/tracking/?cargo_number=59000123456789',
  };

  return {
    subject: replaceTemplateVariables(template.subject, sampleVariables),
    body: replaceTemplateVariables(template.body, sampleVariables),
  };
}
