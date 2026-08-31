/**
 * File-type validation for upload routes.
 *
 * The bug this replaces
 * ────────────────────
 * Upload routes guarded their allow-list like this:
 *
 *     if (file.type && !ALLOWED.test(file.type)) reject();
 *
 * `file.type` is whatever the client wrote in the multipart part header, and
 * it is optional. Omit it — trivial with curl — and the condition
 * short-circuits, so the check is skipped for exactly the caller who wants it
 * skipped. The validation was effectively opt-in.
 *
 * Why the fix is not simply "reject an empty type"
 * ────────────────────────────────────────────────
 * That `&&` was not careless — it was protecting a real case. Browsers do not
 * always populate the type for formats they do not recognise, and HEIC/HEIF
 * from iPhones is the common one; those files can arrive with `file.type`
 * empty. Since customers upload phone photos, a hard reject on an empty type
 * would refuse genuine uploads.
 *
 * So: when the client declares a type, that type must be in the allow-list.
 * When it declares nothing, fall back to the file extension instead of
 * skipping the check. Both paths end in a decision — neither ends in "allow".
 *
 * Note the declared type is still only a claim. Callers that store the file
 * publicly should also pin the stored contentType to a safe value rather than
 * echoing the client's, so a mislabelled file can never be served back as
 * active content.
 */

export interface UploadTypeRule {
    /** Matched against the client-declared MIME type when one is present. */
    mime: RegExp;
    /** Lower-case extensions, no dot, used when no MIME type is declared. */
    ext: string[];
}

/** The extension of a file name, lower-case and without the dot ('' if none). */
export function fileExtension(fileName: string): string {
    return (fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
}

/**
 * True when the upload is an accepted type.
 *
 * Never returns true merely because the client said nothing.
 */
export function isAllowedUpload(
    fileName: string,
    declaredType: string | undefined | null,
    rule: UploadTypeRule,
): boolean {
    const type = String(declaredType || '').trim().toLowerCase();
    if (type) return rule.mime.test(type);
    return rule.ext.includes(fileExtension(fileName));
}

/** Raster images customers upload from a phone or camera. */
export const IMAGE_RULE: UploadTypeRule = {
    mime: /^image\/(jpeg|jpg|png|webp|heic|heif)$/i,
    ext: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
};

/** Images plus PDF, for order artwork and admin attachments. */
export const IMAGE_OR_PDF_RULE: UploadTypeRule = {
    mime: /^image\/(jpeg|jpg|png|webp|heic|heif)$|^application\/pdf$/i,
    ext: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'],
};
