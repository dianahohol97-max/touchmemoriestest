// Human-friendly order number: TM-YYMMDD-XXXX (e.g. TM-260609-K7P2).
// Short and easy to read/type (the old format was TM-<13-digit-timestamp>-XXXX,
// which was long and looked like a hash). The date prefix keeps it sortable and
// the 4-char random suffix avoids collisions within a day. Used by every order
// insert path (regular checkout, designer flow, magazine-text brief) so the
// number is consistent everywhere it's shown and on the /track lookup.
export function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TM-${ymd}-${code}`;
}
