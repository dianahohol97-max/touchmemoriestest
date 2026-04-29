import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import type { DesignBrief, BriefFormData, PhotoMetadata } from '@/lib/types/designer-service';

/**
 * Token-based brief access.
 *
 * IMPORTANT: design_briefs RLS no longer permits anonymous access by token —
 * the previous USING (true) policy was a footgun (it allowed enumeration of
 * any brief by anyone). All token-keyed reads/writes here go through the
 * service-role admin client, which bypasses RLS but only after we explicitly
 * validate the token at the application layer. The token itself is the
 * capability — knowing it grants access, not knowing it does not.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function isValidToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

/**
 * Get design brief by token (public access — token IS the capability).
 */
export async function getDesignBriefByToken(token: string): Promise<DesignBrief | null> {
  if (!isValidToken(token)) return null;
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('design_briefs')
    .select(`
      *,
      order:orders(
        id,
        order_number,
        customer:customers(name, email, phone)
      )
    `)
    .eq('token', token)
    .single();

  if (error || !data) return null;

  return data as any;
}

/**
 * Submit brief form data
 */
export async function submitBrief(
  token: string,
  formData: BriefFormData
): Promise<{ success: boolean; error?: string }> {
  if (!isValidToken(token)) return { success: false, error: 'Invalid token' };
  try {
    const supabase = getAdminClient();

    const { error } = await supabase
      .from('design_briefs')
      .update({
        ...formData,
        status: 'brief_received',
        submitted_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update photos metadata after upload
 */
export async function updatePhotosMetadata(
  token: string,
  photos: PhotoMetadata[]
): Promise<{ success: boolean; error?: string }> {
  if (!isValidToken(token)) return { success: false, error: 'Invalid token' };
  try {
    const supabase = getAdminClient();

    const { error } = await supabase
      .from('design_briefs')
      .update({
        photos_metadata: photos,
        photos_count: photos.length,
      })
      .eq('token', token);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload photo to Supabase Storage
 */
export async function uploadPhoto(
  orderId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `design-briefs/${orderId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('design-briefs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('design-briefs')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get order details for brief — admin-only path (no token here, called from
 * authenticated admin/designer contexts).
 */
export async function getOrderForBrief(orderId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      with_designer,
      designer_service_fee,
      brief_token,
      customer:customers(name, email, phone),
      items
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if brief is accessible (paid order with designer service).
 * Uses service role + token validation for the same reason as above.
 */
export async function isBriefAccessible(token: string): Promise<boolean> {
  if (!isValidToken(token)) return false;
  const supabase = getAdminClient();

  const { data } = await supabase
    .from('design_briefs')
    .select(`
      id,
      order:orders!inner(
        id,
        paid_at,
        with_designer
      )
    `)
    .eq('token', token)
    .single();

  if (!data) return false;

  const order = (data as any).order;
  return order.paid_at !== null && order.with_designer === true;
}

/**
 * Get style preference details
 */
export function getStyleDetails(style: string) {
  const styles = {
    minimal: {
      name: 'Мінімалістичний',
      description: 'Чистий, простий, багато білого простору',
      colors: ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#333333'],
      fonts: ['Helvetica Neue', 'Arial', 'Roboto'],
    },
    bright: {
      name: 'Яскравий',
      description: 'Насичені кольори, енергійний, веселий',
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF'],
      fonts: ['Comic Sans MS', 'Arial Rounded', 'Fredoka'],
    },
    classic: {
      name: 'Класичний',
      description: 'Елегантний, витончений, традиційний',
      colors: ['#2C3E50', '#8E7F6F', '#C9B8A8', '#F4EFE6'],
      fonts: ['Georgia', 'Times New Roman', 'Playfair Display'],
    },
    romantic: {
      name: 'Романтичний',
      description: 'Ніжний, м\'який, пастельні відтінки',
      colors: ['#FFE5E5', '#FFF0F5', '#E6E6FA', '#F0E5CF'],
      fonts: ['Dancing Script', 'Pacifico', 'Great Vibes'],
    },
    kids: {
      name: 'Дитячий',
      description: 'Яскравий, веселий, ігровий',
      colors: ['#FFB6C1', '#87CEEB', '#98FB98', '#FFD700'],
      fonts: ['Comic Neue', 'Bubblegum Sans', 'Fredoka'],
    },
  };

  return styles[style as keyof typeof styles] || styles.classic;
}

/**
 * Get occasion details
 */
export function getOccasionDetails(occasion: string) {
  const occasions = {
    wedding: { name: 'Весілля', icon: '', emoji: '' },
    birthday: { name: 'День народження', icon: '', emoji: '' },
    travel: { name: 'Подорож', icon: '', emoji: '' },
    family: { name: 'Сімейний альбом', icon: '', emoji: '' },
    baby: { name: 'Дитяча', icon: '', emoji: '' },
    graduation: { name: 'Випускний', icon: '', emoji: '' },
    corporate: { name: 'Корпоратив', icon: '', emoji: '' },
    other: { name: 'Інше', icon: '', emoji: '' },
  };

  return occasions[occasion as keyof typeof occasions] || occasions.other;
}
