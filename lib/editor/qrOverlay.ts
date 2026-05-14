// QR Overlay support for the photobook editor.
//
// Two flavours of QR overlay:
// - 'generated': built from a URL/text typed by the user in the editor.
//   The DM-side surcharge is +50₴ per *generation* (not per placement),
//   tracked via `generatedQRCount` on the editor state — see pricing
//   integration in BookLayoutEditor.
// - 'uploaded': user-supplied PNG. No surcharge — they're bringing their
//   own image.
//
// Both kinds are stored as positioned overlays on a page index, with the
// same shape used by pageStickers (x/y/w/h as numbers in canvas px).

import QRCodeLib from 'qrcode';

export const QR_PRICE_PER_GENERATION = 50;

export type QROverlayKind = 'generated' | 'uploaded';

export interface QROverlay {
    id: string;
    kind: QROverlayKind;
    // For generated: the source URL/text that was encoded — kept so we can
    // re-render if needed and so the operations team can verify what was
    // sent to print. For uploaded: empty string.
    source: string;
    // PNG data URL of the actual QR image. For generated, produced by
    // qrcode.toDataURL with classic B&W styling. For uploaded, the user's
    // PNG.
    dataUrl: string;
    // Position in canvas pixels (matches pageStickers convention).
    x: number;
    y: number;
    w: number;
    h: number;
}

// Generate a classic black-and-white QR PNG from a URL or text.
// Returns a PNG data URL ready to be dropped into <img src>.
export async function generateQRDataUrl(text: string): Promise<string> {
    if (!text || !text.trim()) {
        throw new Error('QR text is empty');
    }
    // Margin 1 = single quiet zone module. The print partner asks for
    // adequate quiet zone, and a single module on a 300px image is plenty
    // since the placement size in the book is at minimum 80px.
    // errorCorrectionLevel 'M' = ~15% recovery — works fine even on print
    // and is the default; classic B&W look is the qrcode default.
    return QRCodeLib.toDataURL(text.trim(), {
        margin: 1,
        width: 600,
        errorCorrectionLevel: 'M',
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });
}

// Default starting size for a freshly added QR (in canvas pixels). The
// editor canvas is roughly 700–1400px wide depending on size, so 120px is
// visually noticeable but not overwhelming.
export const QR_DEFAULT_SIZE = 120;
// Minimum size we allow during resize — below this a printed QR may not
// scan reliably even with error correction.
export const QR_MIN_SIZE = 60;
// Maximum size — half of typical canvas width.
export const QR_MAX_SIZE = 400;

// Naive URL/text validation. Generation works for any non-empty text but
// we warn the user (in the sidebar) if it doesn't look like a URL, since
// that's the overwhelming use case.
export function looksLikeUrl(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    return /^(https?:\/\/|www\.|t\.me\/|instagram\.com\/|youtube\.com\/|youtu\.be\/)/i.test(t);
}
