/**
 * Which cover materials can actually take an engraved inscription.
 *
 * Diana, 2026-08-20: «заборона на гравіювання на тканині та шкірзамі».
 *
 * Until this existed the constructor offered engraving on every cover except
 * the printed one, so a customer could order fabric with an engraved name and
 * production would refuse it later. The workshop's rule had lived only in
 * KeyCRM and in Марія's head — which is how Оксана came to ask in the chat and
 * Софія had nothing to answer from.
 *
 * One module because three places need the same answer and must never drift:
 * the editor (what it offers), Софія (what she tells the team), and any future
 * validation on the order itself.
 *
 * Velour takes engraving. Fabric and faux leather do not — the pile burns on
 * one and the coating melts on the other. A printed cover has no inscription
 * layer at all: its lettering is part of the artwork.
 */

/** Cover materials engraving is refused on, matched loosely on the label. */
const ENGRAVING_FORBIDDEN = /(тканин|fabric|шкірзам|шкірзамін|екошкір|faux\s*leather)/iu;

/** A printed cover carries no separate inscription — the text is in the design. */
const PRINTED_COVER = /(друкован|printed)/iu;

export function isPrintedCover(coverType: string | null | undefined): boolean {
    return PRINTED_COVER.test(String(coverType || ''));
}

/**
 * True when an engraved inscription may be offered on this cover material.
 * An unknown or empty material returns true: the editor already restricts the
 * choice to real covers, and refusing on a name we simply do not recognise
 * would silently remove a legitimate option.
 */
export function engravingAllowedOn(coverType: string | null | undefined): boolean {
    const label = String(coverType || '');
    if (!label) return true;
    if (isPrintedCover(label)) return false;
    return !ENGRAVING_FORBIDDEN.test(label);
}

/** Why it is refused, for the message shown to a customer or to the team. */
export function engravingRefusalReason(coverType: string | null | undefined): string | null {
    if (engravingAllowedOn(coverType)) return null;
    if (isPrintedCover(coverType)) {
        return 'на друкованій обкладинці напис друкується разом із малюнком, окремого гравіювання немає';
    }
    return 'на тканині та шкірзаміннику гравіювання не робимо';
}

/** Materials that DO take engraving, for a positive answer in chat. */
export const ENGRAVING_ALLOWED_LABEL = 'велюр';
