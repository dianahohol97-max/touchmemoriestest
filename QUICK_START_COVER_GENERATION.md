# QUICK START: Travel Cover Generation

## ✅ Database Migration Complete

You've successfully run the database migrations. You should now have:
- ✅ 55 cities in `travel_book_covers` table (status: pending)
- ✅ `travel-covers` storage bucket created
- ✅ Navigation dropdown shows 7 poster items

## 🚀 Next Step: Generate Covers

### Option 1: Use Real Nano Banana API

If you have Nano Banana API credentials:

1. **Add credentials to `.env.local`:**
```bash
NANO_BANANA_API_ENDPOINT=https://your-api-endpoint.com/generate
NANO_BANANA_API_KEY=your_api_key_here
```

2. **Run generation script:**
```bash
node scripts/generate-travel-covers.mjs
```

3. **Monitor progress:**
The script will:
- Process all 55 cities in batches of 5
- Show progress for each city
- Auto-retry failures (max 3 attempts)
- Display final summary

**Expected time:** ~30-45 minutes (depending on API speed)

---

### Option 2: Test with Simulation Mode (Recommended First)

To test the workflow without using API credits:

```bash
node scripts/generate-travel-covers.mjs
```

The script will automatically detect missing API credentials and run in **simulation mode**:
- Uses placeholder images
- 3-second delay per cover (simulates API call)
- Updates database with simulation URLs
- Perfect for testing UI integration

**Expected time:** ~3 minutes

---

## 🧪 Verify Results

After generation completes:

1. **Check database status:**
```sql
SELECT generation_status, COUNT(*)
FROM travel_book_covers
GROUP BY generation_status;
```

Expected result:
- `approved: 55` (simulation mode)
- or `approved: ~50, flagged: ~3, failed: ~2` (real API)

2. **Test cover selector:**
- Go to: http://localhost:3000/order/book?product=travelbook
- Scroll to "Обкладинка Travel Book"
- Click "Обрати обкладинку"
- Modal should show 55 cities with images

3. **Verify storage:**
- Supabase Dashboard → Storage → `travel-covers` bucket
- Should contain generated images

---

## 📊 What Happens During Generation?

### Console Output Example:

```
╔════════════════════════════════════════════════════════╗
║   Travel Book Cover Generator (Nano Banana API)       ║
╚════════════════════════════════════════════════════════╝

✓ Found 55 pending covers
→ Split into 11 batches of 5 covers each

=== Processing Batch 1/11 (5 covers) ===

→ Processing Київ (Kyiv) - Attempt 1/3
→ Generating cover for Kyiv...
✓ Quality check passed for Kyiv
→ Uploading Kyiv to Supabase Storage...
✓ Uploaded Kyiv successfully
✓ Київ (Kyiv) completed successfully

→ Processing Львів (Lviv) - Attempt 1/3
...
```

### Quality Control:

The script automatically checks each cover for:
- ❌ Gradients or textures → FLAGS for review
- ❌ Drop shadows → FLAGS for review
- ❌ City name not legible → FLAGS for review
- ❌ Wrong landmark → FLAGS for review

Flagged covers are still uploaded but marked for manual review.

---

## 🎨 Design System Reminder

Each cover MUST follow these rules:

✅ **Canvas:** Portrait, solid flat color (no gradients)
✅ **Typography:** Bold sans-serif, ALL CAPS, upper 30%
✅ **Illustration:** Single flat object, lower 60%, 1-3 colors
✅ **Negative space:** Minimum 25% of cover
❌ **Forbidden:** No gradients, shadows, borders, textures, photos

**Prompt template used for each city:**
```
Flat vector illustration of [CITY], [COUNTRY] featuring [LANDMARK].
Clean geometric shapes, bold saturated colors, minimal detail.
City name "[CITY]" integrated in bold compressed sans-serif, ALL CAPS, centered in upper 30%.
Illustration centered in lower 60%, single focal object, 1-3 colors.
Background: solid flat [COLOR] color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.
```

---

## 🔧 Troubleshooting

### Problem: Script errors immediately

**Check:**
1. Supabase credentials in `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...  # Important! Must be service role key
   ```

2. Run from project root:
   ```bash
   cd /Users/dianahohol/Desktop/touchmemories/touchmemories6
   node scripts/generate-travel-covers.mjs
   ```

### Problem: API rate limit errors

**Solution:** Adjust delays in script:
```javascript
const RATE_LIMIT_DELAY_MS = 5000;  // Increase from 2000 to 5000
```

### Problem: Some covers failed

**Solution:** Re-run only failed covers:
```sql
UPDATE travel_book_covers
SET generation_status = 'pending', generation_attempts = 0
WHERE generation_status = 'failed';
```

Then re-run script.

---

## ✅ When Complete

After all covers are generated:

1. **Commit results** (optional - images are in Supabase Storage, not git):
```bash
git add QUICK_START_COVER_GENERATION.md
git commit -m "docs: add quick start guide for cover generation"
git push origin main
```

2. **Deploy to Vercel:**
- Vercel auto-deploys on push
- Add Nano Banana API credentials in Vercel Dashboard (if using real API in production)

3. **Test on production:**
- Visit: https://touchmemories1.vercel.app/order/book?product=travelbook
- Verify cover selector shows all cities
- Select a cover and verify it appears in form

---

## 📈 Expected Final State

After successful generation:

- **Database:** 55 cities, 50-55 approved, 0-5 flagged/failed
- **Storage:** 50-55 PNG images in `travel-covers` bucket
- **UI:** Cover selector modal shows all approved covers
- **User Flow:** User can select any city cover for their Travel Book

**Next milestone:** All 5 new poster constructors + Travel Book covers = 100% complete!

🤖 Generated with [Claude Code](https://claude.com/claude-code)
