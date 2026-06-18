# Editor performance plan (deferred)

Status: **planned, not started.** Owner decision pending (Diana).
Scope: `components/BookLayoutEditor.tsx` and the photo upload/export pipeline.

This captures the larger, riskier performance work that was intentionally
*not* done in the quick-fix pass, so it can be picked up later as a dedicated,
carefully-tested task.

## What was already shipped (quick wins, low risk)

These are live and address load time + worsening lag over a session:

1. **Skip doomed full-base64 serialization.** The photo-persistence effect used
   to `JSON.stringify` every photo with its full data URL (~100 MB+ for 50
   photos) on the main thread on every `photos` change, always blew the ~5 MB
   sessionStorage quota, and fell back to metadata anyway. Now it estimates the
   payload size first and writes metadata-only when full previews can't fit.
2. **Batch focal-point detection.** `detectFocalPoint` called `setPhotos` once
   per photo (50 photos = 50 full editor re-renders on load, each re-firing the
   autosave + persistence effects). Results are now buffered and flushed in one
   debounced state update.
3. **Lazy-load rail thumbnails + photo strips/grids** (`loading="lazy"`).
   Off-screen spread thumbnails and the photo list no longer decode/paint until
   scrolled into view, so the rail stops getting heavier as spreads grow. The
   main editing canvas + export images were left untouched.

## The remaining big lever (the risky one)

**Root cause:** print/export = `html2canvas` snapshot of the editor DOM
(`[data-spread-snapshot="root"]`). Because the printed pixels come from the
on-screen `<img>` elements, those images must be at *print* resolution. With ~50
source photos kept as full-resolution base64 in React state (up to ~8 MB each),
the editor holds ~hundreds of MB in memory. That is the dominant cost; it can't
be reduced by simply downscaling previews, because that would degrade print.

**Goal:** keep print quality identical while cutting the in-memory / on-screen
image weight ~10×.

### Recommended approach — Option A: display previews + export-from-originals

Decouple the on-screen preview resolution from the export resolution.

1. **Upload pipeline.** When building a `PhotoData`, generate TWO things:
   - `displayPreview`: downscaled (e.g. max ~1600 px longest side, JPEG ~0.82),
     used for ALL on-screen rendering (main canvas + thumbnails + strips).
   - keep the **original** (full-res `File`/blob or original data URL) for export
     ONLY — stored OUTSIDE React state (a `useRef` `Map<id, Blob|string>` or
     IndexedDB) so it never bloats re-renders or the autosave/persistence
     stringify.
   Do the downscale async/batched (canvas or `createImageBitmap`), not blocking.
2. **State.** `photos[].preview` becomes the light `displayPreview`. Originals
   live in the ref map keyed by photo id. Persistence/autosave already exclude
   base64 for large sets — keep that.
3. **Export.** In the snapshot routine, for each slot temporarily swap the
   `<img src>` from `displayPreview` to the full-res original (await
   `img.decode()` before capture), run `html2canvas` at the print scale, then
   restore the display preview. Alternative: render a hidden export-only DOM at
   print size with original `src`s. Crop/zoom/focal math is percentage-based, so
   it maps identically at both resolutions — no placement change.
4. **Reopen / hard-refresh.** Originals held only in a session ref are gone after
   refresh or when reopening a saved design. For full-res export in that case,
   re-fetch originals from the uploaded order-files (Supabase `order-files`
   bucket) by filename/id before export. If an original is genuinely
   unavailable, fall back to the display preview (lower-res) — acceptable only as
   an edge case, and should warn.

### Lower-effort follow-ups (independent of Option A)

- **Memoize the spread-rail thumbnail.** Extract the per-spread thumbnail into a
  `React.memo` component so editing one spread doesn't re-render all 17+ rail
  thumbnails. (Currently inline in the `.map`; extraction is the main work.)
- **Cap focal-detection concurrency.** Detection is now batched, but still decodes
  50 full images near-simultaneously on load; limit to ~4 concurrent decodes.
- **Cheaper autosave.** The draft autosave `JSON.stringify`s all `pages` every
  1.5 s after edits; fine today, but if pages grow large, consider diffing or
  moving serialization off the main thread.
- **Virtualize the spreads rail** for very long books (only render rail items
  near the viewport). Lazy-load already mitigates image cost; virtualization
  would also cut DOM/reconciliation cost.

## Acceptance criteria

- In-memory image footprint cut ~10× (display previews in state; originals in a
  ref/IndexedDB, not state).
- Editing, dragging, and switching spreads stay smooth with 50+ photos and 20+
  spreads through a long session (no progressive slowdown).
- **Exported/printed files are byte-for-byte equivalent in resolution/quality**
  to today — verify exported JPEG pixel dimensions per product (photobook spread,
  magazine A4, travelbook covers) before/after. This is the highest-stakes check.
- No regression in crop/zoom/focal placement (percentage math unchanged).

## Risk notes

- Highest risk is **print quality** — never ship Option A without verifying
  exported pixel dimensions across all product types.
- Touch points: upload handlers / `PhotoData` shape, the export/snapshot routine
  (`[data-spread-snapshot="root"]` capture), reopen photo-loading, the
  autosave + photo-persistence effects.
- Do it on a branch with side-by-side export comparison, not mid-session.
