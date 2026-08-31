import { describe, expect, it } from 'vitest';
import {
    isAllowedUpload,
    fileExtension,
    IMAGE_RULE,
    IMAGE_OR_PDF_RULE,
} from '@/lib/upload/file-type';

/**
 * Upload type validation.
 *
 * The rule this pins: an upload is accepted only if something positively says
 * it is allowed. The old `if (file.type && !ALLOWED.test(file.type))` shape
 * failed that — omitting the multipart Content-Type skipped the check
 * entirely, which is trivially done with curl.
 *
 * The second rule matters just as much: an empty Content-Type must NOT be a
 * hard reject, because iPhone HEIC uploads legitimately arrive that way. The
 * fallback to the extension is what lets both rules hold at once.
 */

describe('fileExtension', () => {
    it('reads the extension, lower-cased and without the dot', () => {
        expect(fileExtension('Photo.JPG')).toBe('jpg');
        expect(fileExtension('a.b.heic')).toBe('heic');
    });

    it('is empty when there is no extension', () => {
        expect(fileExtension('noextension')).toBe('');
        expect(fileExtension('')).toBe('');
    });
});

describe('isAllowedUpload — declared MIME type', () => {
    it('accepts an allowed type', () => {
        expect(isAllowedUpload('a.jpg', 'image/jpeg', IMAGE_RULE)).toBe(true);
        expect(isAllowedUpload('a.heic', 'image/heic', IMAGE_RULE)).toBe(true);
    });

    it('rejects a disallowed type even when the extension looks fine', () => {
        // The attack shape: name it .jpg, declare it as HTML.
        expect(isAllowedUpload('a.jpg', 'text/html', IMAGE_RULE)).toBe(false);
        expect(isAllowedUpload('a.png', 'image/svg+xml', IMAGE_RULE)).toBe(false);
    });

    it('rejects PDF under the image-only rule but accepts it under image+pdf', () => {
        expect(isAllowedUpload('a.pdf', 'application/pdf', IMAGE_RULE)).toBe(false);
        expect(isAllowedUpload('a.pdf', 'application/pdf', IMAGE_OR_PDF_RULE)).toBe(true);
    });
});

describe('isAllowedUpload — no declared type (the bug that was fixed)', () => {
    it('does NOT wave the file through when the type is missing', () => {
        // This is the regression: previously `file.type && …` short-circuited
        // and every one of these was accepted.
        expect(isAllowedUpload('payload.html', '', IMAGE_RULE)).toBe(false);
        expect(isAllowedUpload('payload.svg', undefined, IMAGE_RULE)).toBe(false);
        expect(isAllowedUpload('payload.exe', null, IMAGE_RULE)).toBe(false);
        expect(isAllowedUpload('noextension', '', IMAGE_RULE)).toBe(false);
    });

    it('still accepts a real photo whose type the browser did not set', () => {
        // iPhone HEIC often arrives with an empty type — a hard reject here
        // would refuse genuine customer uploads.
        expect(isAllowedUpload('IMG_0421.HEIC', '', IMAGE_RULE)).toBe(true);
        expect(isAllowedUpload('IMG_0421.heif', undefined, IMAGE_RULE)).toBe(true);
        expect(isAllowedUpload('scan.JPG', '', IMAGE_RULE)).toBe(true);
    });

    it('treats a whitespace-only type as absent, not as a type', () => {
        expect(isAllowedUpload('a.jpg', '   ', IMAGE_RULE)).toBe(true);
        expect(isAllowedUpload('a.html', '   ', IMAGE_RULE)).toBe(false);
    });
});
