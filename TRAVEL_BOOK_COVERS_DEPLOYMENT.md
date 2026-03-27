# TRAVEL BOOK COVERS DEPLOYMENT GUIDE

## 🎉 Summary

Successfully created a Travel Book city cover illustration system with:
- **55 city covers** (14 Ukrainian + 41 International cities)
- **Nano Banana API integration** for batch generation
- **Cover selector component** integrated into Travel Book constructor
- **Supabase Storage** for cover images
- **Quality control** system with automatic flagging

---

## 📋 STEP 1: Run Database Migrations

### Migration 1: Create travel_book_covers Table

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260327060000_create_travel_book_covers.sql`
3. Paste and click **Run**

**What this does:**
- Creates `travel_book_covers` table with 55 pre-seeded cities
- All records start with `generation_status = 'pending'`
- Includes AI prompts for each city
- Adds indexes for performance

**Verify:**
```sql
SELECT COUNT(*) FROM travel_book_covers;
-- Should return 55

SELECT COUNT(*) FROM travel_book_covers WHERE group_type = 'ukrainian';
-- Should return 14

SELECT COUNT(*) FROM travel_book_covers WHERE group_type = 'international';
-- Should return 41
```

### Migration 2: Create Supabase Storage Bucket

1. In Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260327060001_create_travel_covers_bucket.sql`
3. Paste and click **Run**

**What this does:**
- Creates `travel-covers` storage bucket
- Sets bucket to public (covers can be displayed on website)
- Sets 5MB file size limit
- Allows PNG, JPEG, WebP formats
- Configures RLS policies

**Verify:**
```sql
SELECT * FROM storage.buckets WHERE id = 'travel-covers';
-- Should return 1 row
```

---

## 📋 STEP 2: Configure Nano Banana API

### Add Environment Variables

Create or update `.env.local`:

```bash
# Nano Banana API Configuration
NANO_BANANA_API_ENDPOINT=https://your-api-endpoint.com/generate
NANO_BANANA_API_KEY=your_api_key_here

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Nano Banana API Requirements

The generation script expects the following API behavior:

**Request Format:**
```typescript
POST https://your-api-endpoint.com/generate
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: multipart/form-data

Body (FormData):
  prompt: string  // The full AI prompt
  width: 600      // Image width in pixels
  height: 900     // Image height in pixels
  format: "png"   // Output format
```

**Response Format:**
```json
{
  "image_url": "https://cdn.example.com/generated-image.png"
}
```

The script will:
1. Send the prompt from database
2. Download the generated image
3. Upload to Supabase Storage
4. Update database record

---

## 📋 STEP 3: Generate City Cover Illustrations

### Option A: Run Batch Generation Script (RECOMMENDED)

```bash
# Navigate to project root
cd /Users/dianahohol/Desktop/touchmemories/touchmemories6

# Make script executable
chmod +x scripts/generate-travel-covers.mjs

# Run the script
node scripts/generate-travel-covers.mjs
```

**What happens:**
1. Fetches all 55 pending covers from database
2. Processes in batches of 5 (configurable)
3. For each city:
   - Sends AI prompt to Nano Banana API
   - Downloads generated image
   - Runs quality check (flags gradients, shadows, illegible text)
   - Uploads to Supabase Storage if approved
   - Updates database with status
4. Auto-retries failed generations (max 3 attempts)
5. Displays progress and final summary

**Expected Output:**
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

... (continues for all 55 covers)

╔════════════════════════════════════════════════════════╗
║                   GENERATION SUMMARY                   ║
╚════════════════════════════════════════════════════════╝

✓ Total Processed: 55
✓ Approved: 52
⚠ Flagged for Review: 2
✗ Failed: 1

Flagged Covers (require manual review):
  - Paris
  - Amsterdam

Failed Covers (max retries exceeded):
  - Tokyo

Final Database Status:
  Approved: 52
  Flagged: 2
  Failed: 1
  Pending: 0

✓ Generation complete!
```

### Option B: Simulation Mode (No API)

If you don't have Nano Banana API configured yet, the script runs in simulation mode:

```bash
node scripts/generate-travel-covers.mjs
```

**Simulation behavior:**
- Uses placeholder images (via placeholder.com)
- 3-second delay per cover (simulates API call)
- All quality checks pass
- Updates database with simulation data

This is useful for:
- Testing the workflow
- UI/UX development
- Database verification

### Monitoring Generation Progress

Check generation status in real-time:

```sql
SELECT
    generation_status,
    COUNT(*) as count
FROM travel_book_covers
GROUP BY generation_status;
```

View flagged covers:

```sql
SELECT city_name, city_name_en, flagged_reason
FROM travel_book_covers
WHERE generation_status = 'flagged';
```

View failed covers:

```sql
SELECT city_name, city_name_en, generation_attempts, flagged_reason
FROM travel_book_covers
WHERE generation_status = 'failed';
```

---

## 📋 STEP 4: Manual Review (If Needed)

If covers are flagged, review them manually:

1. Go to Supabase Storage → `travel-covers` bucket
2. Find the flagged cover images
3. Visually inspect:
   - Is city name legible?
   - Is it flat design (no gradients/shadows)?
   - Is landmark correct?
   - Does it match design system?

4. If acceptable → approve:
```sql
UPDATE travel_book_covers
SET generation_status = 'approved', flagged_reason = NULL
WHERE id = 'uuid-of-flagged-cover';
```

5. If not acceptable → regenerate:
```sql
UPDATE travel_book_covers
SET generation_status = 'pending', generation_attempts = 0
WHERE id = 'uuid-of-flagged-cover';

-- Then re-run the generation script
```

---

## 📋 STEP 5: Verify Integration

### Test Cover Selector in Travel Book Constructor

1. Go to: https://touchmemories1.vercel.app/order/book?product=travelbook

2. **Expected UI:**
   - Configuration form with standard options (size, pages, etc.)
   - NEW: "Обкладинка Travel Book" section
   - Button: "Обрати обкладинку"

3. **Click "Обрати обкладинку":**
   - Modal opens with cover selector
   - Search bar at top
   - 3 tabs: "Всі" / "Українські міста" / "Міжнародні"
   - Grid of city covers (5 columns on desktop)
   - Each cover shows thumbnail + city name + country

4. **Select a cover:**
   - Click any city cover
   - Purple ring appears (selected state)
   - Click anywhere outside or close button
   - Selected cover appears in configuration form
   - Shows: thumbnail + city name + country + "Змінити" button

5. **Continue to upload:**
   - Click "Продовжити до завантаження фото"
   - Cover selection saved in sessionStorage
   - Available in upload/editor steps

### Check Database

Verify approved covers are displayed:

```sql
SELECT
    city_name,
    city_name_en,
    country,
    image_url,
    generation_status
FROM travel_book_covers
WHERE is_active = true
AND generation_status = 'approved'
ORDER BY sort_order;
```

Should return all approved covers with valid image URLs.

---

## 📋 STEP 6: Deploy to Production

### Vercel Deployment

1. **Push to GitHub:**
```bash
git add .
git commit -m "feat: add Travel Book city cover selector with 55 city illustrations"
git push origin main
```

2. **Vercel Auto-Deploys:**
   - Vercel detects push and starts build
   - New code deployed automatically

3. **Add Environment Variables in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add:
     ```
     NANO_BANANA_API_ENDPOINT = your_endpoint
     NANO_BANANA_API_KEY = your_key
     SUPABASE_SERVICE_ROLE_KEY = your_service_key
     ```
   - Click "Save"
   - Redeploy if needed

4. **Test on Production:**
   - Visit: https://touchmemories1.vercel.app/order/book?product=travelbook
   - Verify cover selector works
   - Select a cover
   - Check preview images load

---

## 📊 DESIGN SYSTEM REFERENCE

All 55 covers follow these strict rules:

### Visual Rules:
- **Canvas:** Portrait orientation, solid flat-color background
- **Typography:** Bold compressed sans-serif (Bebas Neue/Oswald Bold), ALL CAPS, centered in upper 30%
- **Illustration:** Single flat-vector object centered in lower 60%, 1-3 colors, simplified silhouette
- **Negative Space:** Minimum 25% of cover area
- **Forbidden:** No gradients, no textures, no borders, no patterns, no photos, no shadows, no outlines

### Color Logic:
- Warm backgrounds: Warm-climate destinations (Hawaii, Bali, Egypt, Morocco)
- Cool backgrounds: Urban/northern cities (London, Norway, New York, Iceland)
- Neutral backgrounds: Classic European cities (Paris, Rome, Prague, Berlin)

### Dimensions:
- **Preview:** 600×900 px (for web display)
- **Print:** 20×30 cm portrait orientation (for Travel Book covers)
- **DPI:** 300 DPI for print-ready files

---

## 🔄 RE-RUNNING GENERATION

If you need to regenerate specific covers:

### Regenerate Specific Cities:

```sql
-- Reset to pending status
UPDATE travel_book_covers
SET
    generation_status = 'pending',
    generation_attempts = 0,
    flagged_reason = NULL,
    image_url = 'travel-covers/pending/' || LOWER(REPLACE(city_name_en, ' ', '-')) || '.png'
WHERE city_name_en IN ('Paris', 'London', 'Tokyo');

-- Then re-run the script
node scripts/generate-travel-covers.mjs
```

### Regenerate All Covers:

```sql
UPDATE travel_book_covers
SET
    generation_status = 'pending',
    generation_attempts = 0,
    flagged_reason = NULL,
    image_url = 'travel-covers/pending/' || LOWER(REPLACE(city_name_en, ' ', '-')) || '.png';
```

### Adjust Batch Size or Delays:

Edit `scripts/generate-travel-covers.mjs`:

```javascript
const BATCH_SIZE = 5;                // Process 5 covers at a time
const MAX_RETRIES = 3;               // Max 3 retry attempts
const RETRY_DELAY_MS = 5000;         // 5 seconds between retries
const RATE_LIMIT_DELAY_MS = 2000;    // 2 seconds between batches
```

---

## 📂 FILES CREATED

### Database Migrations:
- `supabase/migrations/20260327060000_create_travel_book_covers.sql` - Main table with 55 cities
- `supabase/migrations/20260327060001_create_travel_covers_bucket.sql` - Storage bucket

### Scripts:
- `scripts/generate-travel-covers.mjs` - Batch generation with retry logic

### Components:
- `components/TravelBookCoverSelector.tsx` - Cover selector UI with search and tabs
- `components/BookConstructorConfig.tsx` - Updated with Travel Book cover integration

### Documentation:
- `TRAVEL_BOOK_COVERS_DEPLOYMENT.md` - This guide

---

## 🐛 TROUBLESHOOTING

### Problem: "No pending covers found"

**Solution:** Check database:
```sql
SELECT generation_status, COUNT(*)
FROM travel_book_covers
GROUP BY generation_status;
```

If all are approved, the script has nothing to do.

### Problem: API errors during generation

**Solution:** Check:
1. API endpoint and key are correct
2. API has sufficient credits/quota
3. Network connection is stable
4. Retry the failed covers (see RE-RUNNING GENERATION)

### Problem: Cover selector shows no covers

**Cause 1:** No approved covers yet
**Solution:** Run generation script first

**Cause 2:** RLS policies blocking access
**Solution:** Check policies:
```sql
SELECT * FROM travel_book_covers WHERE is_active = true AND generation_status = 'approved';
```

### Problem: Images not loading in selector

**Cause:** Storage bucket RLS not configured
**Solution:** Re-run migration 2 or manually check bucket policies in Supabase Dashboard

### Problem: TypeScript compilation errors

**Solution:** Run:
```bash
npm install
npx tsc --noEmit --skipLibCheck
```

---

## ✅ FINAL CHECKLIST

Before marking as complete:

- [ ] Database migration 1 run (travel_book_covers table created)
- [ ] Database migration 2 run (travel-covers bucket created)
- [ ] Nano Banana API credentials configured
- [ ] Generation script executed (55 covers processed)
- [ ] At least 50 covers approved (check database)
- [ ] Cover selector appears in Travel Book constructor
- [ ] Can select a cover from modal
- [ ] Selected cover displays in configuration form
- [ ] Configuration saves to sessionStorage
- [ ] Deployed to Vercel
- [ ] Tested on production URL

---

## 📈 EXPECTED RESULTS

After full deployment:

- **Database:** 55 city records, 50+ approved
- **Storage:** 50+ PNG images in `travel-covers` bucket
- **UI:** Cover selector integrated into Travel Book constructor
- **User Flow:**
  1. Go to Travel Book constructor
  2. See "Обрати обкладинку" button
  3. Click → modal with 55 cities
  4. Search/filter by Ukrainian or International
  5. Select cover → appears in form
  6. Continue to upload step
  7. Cover saved in order configuration

**Status:** Ready for production after STEP 1-6 completion.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
