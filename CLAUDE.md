# Claude Code instructions for TouchMemories

> Read this **first** every session. ARCHITECTURE.md is the deep map; this file is how we work together.

---

## What this project is

E-commerce + photo product editor for **touch.memories**. Stack:
- **Next.js 14** (App Router) + TypeScript
- **Supabase** Postgres (project ID `yivfsicvaoewxrtkrfxr`)
- **Vercel** auto-deploys on push to `main` (no PR review needed — direct-to-main is intentional, this is Diana's solo project)
- **Tailwind** + lucide-react icons

Production: <https://touchmemories1.vercel.app>
Repo: <https://github.com/dianahohol97-max/touchmemoriestest>

For the full map of where everything lives, read `ARCHITECTURE.md`.

---

## Session-start protocol — do this every single session

A second AI agent (**Antigravity**) often pushes commits in parallel between Diana's sessions. Skipping this protocol leads to merge conflicts and lost work.

```bash
git fetch origin && git status
git pull --rebase origin main
```

If `git status` shows untracked or modified files, **do not** reset without asking Diana — she may have local edits in flight.

After any code change, before committing:
```bash
npx tsc --noEmit | grep "error TS" | grep -v "TS2307"
```

`TS2307` is "cannot find module" — it fires on dynamic imports the build tool resolves at runtime, so we filter it out. Real errors stop the commit.

---

## How to make code changes

**Use `str_replace`, never `git apply`.** Patches via `git apply` fail constantly because Antigravity's parallel edits shift line numbers. `str_replace` operates on the actual current file content and is robust.

**Always read the file just before editing.** Stale view output (from earlier in the conversation) is unreliable after any other tool has run — re-view, then edit.

**Commit messages are detailed in English.** Diana reviews these later when debugging regressions, so they need to explain *why* the change was made, not just *what*. Format:
```
fix(scope): one-line summary

Problem: what was broken or surprising
Cause: the root cause that wasn't obvious
Fix: what this commit changes
Verification: what to test to confirm
```

The editor codebase has accumulated dozens of these — they are genuinely useful. Don't shortcut them.

---

## Editor architecture (the largest part of the codebase)

The photo product editor is the most complex component and the place where bugs cluster. Key files:

| File | Purpose | Approx size |
|---|---|---|
| `components/BookLayoutEditor.tsx` | Main editor — all toolbars, drag-drop, photo placement | ~6700 lines |
| `lib/editor/slot-defs.ts` | Geometry of all 289 layout templates | ~380 lines |
| `lib/editor/snap.ts` | Canva-style snap-to-align during slot resize | ~180 lines |
| `lib/editor/auto-build.ts` | Magic Assembly — auto-distribute photos across spreads | ~400 lines |
| `lib/editor/utils.ts` | Shared helpers (size normalisation, focal crop, etc.) | ~200 lines |
| `components/FreeSlotLayer.tsx` | Free-form slots + DPI quality check | ~660 lines |

**Two parallel toolbar implementations.** The slot-edit toolbar exists twice — once for spread layouts (around line 4400 in BookLayoutEditor.tsx) and once for page layouts (around line 4880). They drift apart easily; whenever you change one, **also change the other**.

**Photo edit pipeline (read this before touching upload code):**
1. Original file kept on disk for print upload
2. Preview rendered for editor — keeps original up to 5000px (A3 @ 300 DPI is 4961px), only re-encodes if larger
3. `objectFit: cover` + `transformOrigin: ${cropX}% ${cropY}%` for slot fitting
4. Rotation 90°/270° auto-rezooms to keep slot covered (see fix in commit `5f8fb96`)

---

## Gotchas — things that bit us before

1. **Antigravity (parallel AI agent)** pushes commits between sessions. Always fetch + rebase first. After rebase you sometimes need `git cherry-pick` of just our new commits.

2. **Photo upload double-encoded JPEGs** until commit `c7d8295`. If you see softness regression, check that the upload path doesn't re-encode photos that are already under the size limit.

3. **`image-rendering: -webkit-optimize-contrast`** in CSS triggers nearest-neighbour resampling in Chrome — produces an 8-bit-game pixelation effect. Never set this on `img`. We tried it once and reverted in `66be1b1`.

4. **Edge Functions have `verify_jwt: false`** for legacy reasons. Don't blanket-fix this — some functions intentionally accept unauthenticated calls. Check each one individually.

5. **Magic Assembly hardcoded `cropX:50, cropY:50`** until commit `8a108b8`. If photos look "decapitated" after auto-build, the fix is to use `getFocalCrop()` instead of dead-center.

6. **DPI threshold is 91**, not 150. Anything below 91 shows a warning badge; above is silent. Diana picked this number specifically — don't round it.

7. **Never use 1–2 word sentences** in any Ukrainian content for Diana. This is a global writing rule.

8. **Diana is not pregnant** — do not assume or reference pregnancy in advice.

---

## Git workflow

Direct-to-main, no PRs. Standard sequence after code changes:

```bash
git add -A
git commit -m "$(cat <<'MSG'
fix(scope): summary

Detailed multi-line explanation here.
MSG
)"
git fetch origin main
git pull --rebase origin main   # in case Antigravity pushed during commit
git push origin main
```

GitHub auth: use `gh auth login` once on the local machine. Never paste tokens in chat — they leak into the transcript.

---

## Vercel

- Project ID: `prj_Oz13dkGF3W1JvSVToT8WvZBseBba`
- Team ID: `team_Qve9hriFT9sNYnjWZolAcFXl`
- Auto-deploys on push to `main`, takes ~60–90 seconds
- Manual trigger if needed (deploy hook): `POST https://api.vercel.com/v1/integrations/deploy/prj_Oz13dkGF3W1JvSVToT8WvZBseBba/e1HuPQmmq1` — call from browser DevTools or `curl`, not from Claude bash (api.vercel.com isn't in the allowlist)

### Post-push verification — MANDATORY for every frontend push

After `git push origin main` on any TS/TSX/CSS/JSON change, wait ~2 minutes then verify the deploy succeeded. Vercel does NOT block bad commits — it just marks the deployment ERROR and leaves production on the last good build. Multiple failed deploys can stack up silently if you skip this check.

Use Vercel MCP `list_deployments` (or visit the dashboard) to confirm state is `READY`, not `ERROR` or stuck in `BUILDING`. If `ERROR`, fetch the build log — common failures:
- **TypeScript prop type mismatches** — components consuming `useState<string>` from a parent must accept `string` props, not a narrow union
- **Cross-folder CSS module imports** with `@/` alias through dynamic segments like `[slug]` — use local `./Name.module.css` instead
- **Missing dependency** in package.json after a hand-written import — run `npm install` locally first

Do NOT continue making more frontend commits without confirming the previous one deployed. Stacked broken commits make it harder to bisect later.

---

## Supabase

- Project: `yivfsicvaoewxrtkrfxr`
- All 116 tables have RLS enabled (verified Round-8 audit, 2026-04-29)
- API routes that touch admin data use `requireAdmin` from `lib/auth/guards.ts`
- Migrations live in `supabase/migrations/` and are versioned with the repo
- Active tables (data flowing through them): `products`, `photobook_prices`, `photobook_projects`, `editor_stickers`, `categories`, `site_content`, `site_blocks`, `dashboard_*` (Diana's internal panel)
- ~50 empty tables exist as legacy/half-built features — see `DATABASE.md` for the full inventory

---

## Style conventions

**TypeScript:** `strict: false` in this project (legacy). Don't fight it; just be careful with `null` vs `undefined`.

**React:** function components, hooks. No class components anywhere. State in `useState`/`useReducer` — no Redux, no Zustand.

**Styling:** Tailwind utility classes inline. Some legacy inline `style={{ ... }}` props in the editor for dynamic values — leave them.

**Icons:** lucide-react only. Don't introduce other icon libraries.

**Internationalisation:** Five locales — `uk`, `en`, `ro`, `pl`, `de`. Translations in Supabase `translations` JSONB column, accessed via `getLocalized()` helper. UI is Ukrainian-default.

**No bullet points or 1–2 word sentences in Ukrainian customer-facing copy.** This is a writing rule from Diana, not a code rule, but it matters when generating product descriptions, blog posts, etc.

---

## When in doubt

1. Read `ARCHITECTURE.md` for the area you're touching
2. Check the most recent 5 commits in that file's history with `git log --oneline -5 -- <file>` — recent context tells you what was just changed
3. Ask Diana before destructive operations (resetting state, dropping tables, force-pushing)
4. If Antigravity broke something, the fix is usually `git revert <hash>` not manual reconstruction
