/**
 * Certificate Generation Utilities
 * Handles certificate code generation, validity calculation, and database storage
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Generate a unique 8-character alphanumeric certificate code
 * Format: XXXXXXXX (uppercase letters and numbers, excluding ambiguous chars)
 */
export function generateCertificateCode(): string {
  // Exclude ambiguous characters: 0, O, I, 1, L
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate certificate validity end date
 * Money certificates: 1 year
 * Product certificates: 3 months
 */
export function calculateValidityDate(certificateType: 'money' | 'product'): Date {
  const validUntil = new Date();
  if (certificateType === 'money') {
    validUntil.setFullYear(validUntil.getFullYear() + 1);
  } else {
    validUntil.setMonth(validUntil.getMonth() + 3);
  }
  return validUntil;
}

/**
 * Create certificate record in database
 */
export async function createCertificate(params: {
  certificateType: 'money' | 'product';
  amount?: number;
  productId?: string;
  productName?: string;
  format: 'electronic' | 'printed';
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  deliveryAddress?: any;
  orderId?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  message?: string;
}) {
  const supabase = createClient();

  // Generate unique code
  let code = generateCertificateCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure code is unique
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('code', code)
      .single();

    if (!existing) break;

    code = generateCertificateCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique certificate code');
  }

  // Calculate validity
  const validUntil = calculateValidityDate(params.certificateType);

  // Insert certificate
  const { data, error } = await supabase
    .from('certificates')
    .insert({
      code,
      certificate_type: params.certificateType,
      amount: params.amount,
      product_id: params.productId,
      product_name: params.productName,
      format: params.format,
      recipient_name: params.recipientName,
      recipient_email: params.recipientEmail,
      recipient_phone: params.recipientPhone,
      delivery_address: params.deliveryAddress,
      valid_until: validUntil.toISOString(),
      order_id: params.orderId,
      purchaser_name: params.purchaserName,
      purchaser_email: params.purchaserEmail,
      message: params.message,
      redeemed: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating certificate:', error);
    throw new Error('Failed to create certificate');
  }

  return data;
}

/**
 * Validate certificate code and check if it's redeemable
 */
export async function validateCertificate(code: string) {
  const supabase = createClient();

  const { data: certificate, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !certificate) {
    return {
      valid: false,
      error: 'Сертифікат не знайдено',
    };
  }

  // Check if already redeemed
  if (certificate.redeemed) {
    return {
      valid: false,
      error: 'Сертифікат вже використано',
      certificate,
    };
  }

  // Check if expired
  const validUntil = new Date(certificate.valid_until);
  if (validUntil < new Date()) {
    return {
      valid: false,
      error: 'Термін дії сертифікату закінчився',
      certificate,
    };
  }

  return {
    valid: true,
    certificate,
  };
}

/**
 * Redeem certificate
 */
export async function redeemCertificate(code: string, orderId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('certificates')
    .update({
      redeemed: true,
      redeemed_at: new Date().toISOString(),
      redeemed_order_id: orderId,
    })
    .eq('code', code.toUpperCase())
    .select()
    .single();

  if (error) {
    throw new Error('Failed to redeem certificate');
  }

  return data;
}
