import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared partner-creation for the referral program.
 *
 * One partner = one row in agency_partners + one matching promo_codes row with
 * the SAME code string (the code is both the ?ref link and the checkout promo).
 * Used by the admin «Тревел-партнери» flow and by the photographer cabinet,
 * which enrols photographers into the same program (partner_kind
 * 'photographer') instead of growing a parallel one — commissions, payouts and
 * the admin list all keep working unchanged.
 */

const CYR_TO_LAT: Record<string, string> = {
  'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Є':'YE','Ж':'ZH',
  'З':'Z','И':'Y','І':'I','Ї':'YI','Й':'Y','К':'K','Л':'L','М':'M','Н':'N',
  'О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'KH','Ц':'TS',
  'Ч':'CH','Ш':'SH','Щ':'SHCH','Ь':'','Ю':'YU','Я':'YA',
};

/** Readable LATIN prefix from the partner name + random suffix. */
export function genAgencyCode(name: string): string {
  const translit = (name || 'AG').toUpperCase().split('').map(ch => CYR_TO_LAT[ch] ?? ch).join('');
  const base = translit
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'AG';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}${suffix}`;
}

export interface CreatePartnerInput {
  name: string;
  email: string;
  contactName?: string | null;
  phone?: string | null;
  website?: string | null;
  partnerKind: 'travel_agency' | 'travel_blogger' | 'photographer';
  /** Percent the CLIENT gets off at checkout with this code. */
  clientDiscount: number;
  /** Commission percent on travelbook items. */
  travelbookRate: number;
  /** Commission percent on everything else. */
  otherRate: number;
  sourceRequestId?: string | null;
}

/**
 * Create the promo code + partner pair. Returns the partner row (including
 * cabinet_token) or throws with a readable message. The promo row is rolled
 * back if the partner insert fails — a live discount code with no partner
 * behind it is exactly the orphan the admin flow once produced.
 */
export async function createAgencyPartner(admin: SupabaseClient, input: CreatePartnerInput) {
  let code = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = genAgencyCode(input.name);
    const { data: clash } = await admin
      .from('agency_partners')
      .select('id')
      .ilike('referral_code', candidate)
      .maybeSingle();
    if (!clash) { code = candidate; break; }
  }
  if (!code) throw new Error('could not generate a unique referral code');

  const { data: promo, error: promoErr } = await admin
    .from('promo_codes')
    .insert({
      code,
      type: 'percent',
      value: input.clientDiscount,
      applies_to: 'all',
      is_active: true,
      created_by: 'agency-partner',
      notes: input.partnerKind === 'photographer'
        ? `Промокод фотографа ${input.name}`
        : `Промокод тревел-агенції ${input.name}`,
    })
    .select('id')
    .single();
  if (promoErr || !promo) throw new Error(`promo create failed: ${promoErr?.message || 'unknown'}`);

  const { data: partner, error: partnerErr } = await admin
    .from('agency_partners')
    .insert({
      agency_name: input.name,
      contact_name: input.contactName || null,
      email: input.email,
      phone: input.phone || null,
      website: input.website || null,
      referral_code: code,
      promo_code_id: promo.id,
      travelbook_rate: input.travelbookRate,
      other_rate: input.otherRate,
      status: 'active',
      partner_kind: input.partnerKind,
      source_request_id: input.sourceRequestId || null,
    })
    .select('*')
    .single();
  if (partnerErr || !partner) {
    await admin.from('promo_codes').delete().eq('id', promo.id);
    throw new Error(`partner create failed: ${partnerErr?.message || 'unknown'}`);
  }

  return partner;
}
