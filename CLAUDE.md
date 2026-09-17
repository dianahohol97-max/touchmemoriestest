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

**If the change touches a price — in code, in a migration, or in the admin panel — also run:**
```bash
npm test
```

It finishes in about a second and pins every tier of every page-priced product plus the order in which rush and the flat extras are applied. A failure means either a price genuinely changed (then say so in the commit message and update `tests/pricing-scales.test.ts` in the same commit) or something drifted. Prices had never had a single test until 2026-08-19, which is why the same bugs kept coming back — a price change with a green `npm test` and no explanation in the diff is the thing to be suspicious of.

The database half is checked separately, because tests cannot see Supabase: open `GET /api/admin/pricing/audit` after any price change and confirm `clean: true`.

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

**The slot photo toolbar is now ONE component.** It used to exist twice — once for spread layouts and once for page layouts — with a standing instruction here to remember to change both. They drifted anyway (the page copy grew edge-clamping and a divider the spread copy never got; the spread copy kept a comment the page copy lost). It now lives in `components/editor/SlotPhotoToolbar.tsx` and both modes render it. Change it there.

One difference is still deliberately per-call-site and is noted in that file: the «Слот» tooltip text differs between the modes, pending confirmation of whether shape editing is offered in both. (`shiftX` is also per-call-site, but only because the two canvases measure against different widths — both now pass one, so the bar is edge-clamped in both modes.)

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

9. **Referral program excludes guest checkout BY DESIGN** (Diana, 2026-08-04). The friend↔referrer link is created only in `/api/referral/capture`, which requires a signed-up account — a friend who buys as a guest creates no referral, and there is no back-fill when they register later. This is anti-abuse (guest emails are unverified, so crediting them would allow self-referral with throwaway addresses), NOT a missing feature. The rule is stated in the customer-facing terms on the account page («Запросити друга» tab). Don't "fix" it without an explicit product decision from Diana. Full rationale: comment in `app/api/referral/capture/route.ts`.

---

10. **Polaroid has no finish option, and that is deliberate** (Diana, 2026-08-19). Every sibling in the print family — `photoprint-standard`, `photoprint-nonstandard`, `photomagnets` — carries a «Покриття» option with Глянцеве/Матове. `polaroid-print` carries only «Формат», so polaroid orders arrive with no finish recorded and the admin card shows nothing for it. Asked whether to add the option, Diana said no. **Polaroid is matte by default** — that is the standing answer for production, not something to ask the customer. Don't "fix" the missing option.

11. **Емодзі на гравіювання не йдуть — це правило** (Diana, 2026-09-07). Лазер ріже один колір і одну глибину, тож кольорове емодзі стає чорною плямою, а відсутній гліф — порожнім квадратом. Правило діє для трьох типів оздоблення, які фізично гравіюються: `metal`, `graviruvannya`, `flex`. Друковані вставки (`acryl`, `photovstavka`) кольорові — там напис лишається як є. Реалізація в `lib/print/engravable-text.ts`, і вона стоїть у трьох місцях одразу: у полях вводу конструктора (клієнт бачить відмову, поки пише), у файлі для лазера і в рендері обкладинки. Прибираються символи з властивістю `Emoji_Presentation` плюс послідовності з селектором варіації; знаки ♡ ♥ ★ ☀ ✓ — це типографіка, вони лишаються, заради них у `font-coverage` окремо докладено шрифти. Не «спрощуй» це до `\p{Extended_Pictographic}`: воно забере й сердечка з роздільників.

12. **Міграція, яка додає зовнішній ключ, ламає PostgREST-запити до тієї таблиці** (Diana, 2026-09-14). Правило: **після будь-якої міграції з новим зовнішнім ключем перевір усі вбудовування тієї таблиці в запитах.** Це не теорія, це вже сталося. Міграція `20260914_order_link_review.sql` додала `orders.link_candidate_customer_id` із ключем на `customers`, і в `orders` стало два ключі на ту саму таблицю. PostgREST між ними не вибирає: побачивши `customers(...)` без уточнення, він відмовляє цілим запитом із `PGRST201`, а не віддає частину. Через це на кілька годин лягли список замовлень в адмінці, картка замовлення, список у кабінеті клієнта і сторінка аналітики — і дізналися ми випадково, з журналу помилок. Лікування одне: називати звʼязок повністю, `customers!orders_customer_id_fkey(...)`. Перевірка зводиться до пошуку `.select(` із назвою звʼязаної таблиці без `!` по всьому репозиторію; у `orders` ключів ставатиме більше, тож пастка спрацює знову. Вартість помилки несиметрична: зламане показує себе лише тоді, коли хтось відкриє сторінку, а мовчазний `PGRST201` у журналі нікому не приходить.

13. **Відсів після `LIMIT` — це не фільтр, а лотерея** (Diana, 2026-09-14). Правило: **коли вибірка обмежена лімітом, кожна умова мусить стояти в самому запиті.** Відсіювати рядки в JavaScript після `.limit()` можна тільки тоді, коли ліміт свідомо більший за весь можливий набір. Історія, на якій це загорілося: звірка з KeyCRM брала сто рядків і вже в JS відкидала дзеркалені замовлення й ті, що без картки в CRM. Поки черга йшла за датою створення, серед сотні найновіших випадково траплялося штук двадцять придатних, і все працювало. Щойно черга пішла за `crm_reconciled_at`, усі 880 дзеркалених замовлень із порожньою позначкою стали вічно першими: зі ста вибраних рядків 99 відсіювалися, звірка спинилася зовсім — і виглядало це як **успішний прогін**, бо крон відповідав двомастами і писав у журнал `candidates 0, reconciled 0, errors 0`. Лікування: `.neq('source', …)` та решта умов усередині запиту, до `.limit()`. Той самий дефект живий у `findUnsyncedOrders` (`lib/automation/keycrm-push.ts`) і `findOrdersNeedingStock` (`lib/automation/stock.ts`) — там сторінка на 60 і 160 рядків проти 272 і 607 у вікні. Перевірка зводиться до пошуку `.limit(` із `.filter(` на результаті нижче; шукати треба в чергах і батчах, бо для екрана «останні N» така вибірка нормальна.

14. **Запит до великої таблиці пишеться з пагінацією ОДРАЗУ** (Diana, 2026-09-14). Правило: **будь-яке читання з `orders`, `customers`, `social_messages`, `social_conversations`, `email_logs` і `projects` має або цикл із `.range()`, або свідомий `.limit()`, або фільтр по ключу одного батьківського запису. Дивитися на сьогоднішню кількість рядків НЕ треба — саме це нас і підводило.** PostgREST віддає щонайбільше тисячу рядків і не каже про це нічим: відповідь просто коротша за правду, помилки немає, у журнал не потрапляє ніщо. За один день 14.09.2026 пастка спрацювала чотири рази — список клієнтів (1000 із 1280), дашборд (1000 із 1107, через що «потребує дизайнера» показував 83 замість 122), аналітика на періоді понад сорок сім днів (квартал недоливав 138 218 ₴) і один діалог у скриньці (1000 із 3 021). Щоразу помічали випадково. Шість таблиць у списку — ті, що ростуть від роботи магазину, а не від рішення адміністратора: довідник на кшталт `products` росте тоді, коли Діана щось додає, і тисячу рядків там видно заздалегідь, а ці наповнюються самі і перетинають межу без жодної зміни в коді. Перевірка: `node scripts/unpaginated-queries.mjs` — він друкує ті, що треба переписати, окремо від тих, що обмежені батьківським ключем, і повертає код 1, якщо перший список не порожній. Поточний розбір із числами — `docs/unpaginated-queries.md`. Сусідня гоча 13 про інший бік тієї самої монети: там ліміт є, але фільтр стоїть після нього.

15. **Тихо втрачене ніхто не помітить — рахуй, що його немає** (Diana, 2026-09-17). Правило: **коли крок може частково не спрацювати, замовлення мусить нести ЧИСЛО, скільки мало бути і скільки вийшло, а розбіжність — іти сигналом у робочий чат.** За один день 17.09 знайшлося п'ять поломок, і всі мали одну спільну рису: дані про кожну вже лежали в базі, і ніхто в них не дивився. Фото важчі за 4,5 МБ гинули об стелю Vercel і писали 413 у `upload_attempt_log` — шістнадцять замовлень із восьмого серпня, найгірше TM-001305 (дев'ять знімків із двадцяти шести). Заявка TM-001320 приїхала без товару, бо конфігурація їхала тільки в `sessionStorage`, а адреса була гола. Через нульову суму вона не поїхала в KeyCRM, бо відсів `total > 0` вважав її порожнім кошиком. Листа їй не надіслав ніхто, бо потік із дизайнером через `/api/orders/submit` не проходить. Дізналися ми аж тоді, коли клієнтка через дві доби написала в дирекг сама. Вартість помилки несиметрична: зламане показує себе лише тоді, коли хтось напише нам, а мовчазний рядок у журналі не приходить нікому. Сторож стоїть у `lib/alerts/lost-order-signals.ts` і живе в кроні `keycrm-sync`, який працює доведено, кожні півгодини — НЕ в `error-alerts`, бо той відмовляє цілим маршрутом без `VERCEL_API_TOKEN`. Дивиться чотири ознаки: фото не доїхали, заявка без товару, замовлення без жодного листа, кандидат висить у черзі на перенесення. Кожна ознака кожного замовлення йде в чат рівно один раз, бо сторож, який кричить вовк, вимикають, і тоді ми знову в тиші. Живий стан — рядок `lost_order_signals_watch` у `settings`: сторож, який мовчить, і сторож, якого ніхто не запускав, виглядають однаково, а це різні речі. Додаючи п'яту ознаку, спершу проганяй її по живій базі за тридцять днів: якщо вона ловить більше десятка замовлень, це не ознака, а шум.

16. **Тіло запиту до функції на Vercel — 4,5 МБ, і це межа платформи** (Diana, 2026-09-17). Запит ріжеться ще до того, як наш код запуститься, тож у відповідь приходить голе 413 без пояснення і без жодного рядка в наших журналах. Живі числа з `upload_attempt_log` показують межу до байта: найбільший файл, який доїхав, важив 4 487 593 байти, найменший, який упав, — 4 497 036. Даунскейл на клієнті від цього НЕ рятує, бо `downscaleImageIfLarge` дивиться на сторону в пікселях, а не на вагу: знімок 4032×3024 з айфона проходить перевірку і летить як є, усі свої п'ять мегабайтів. Лікування одне — віддавати файл прямо в сховище за підписаним посиланням, повз наші функції: `/api/upload/order-file-url` для замовлень і `/api/wedding/[slug]/upload-url` для весільної сторінки. Стискати до прохідної ваги НЕ можна: найбільші файли — це ті, що йдуть у друк. Поріг у `lib/storage-upload.ts` стоїть на чотирьох мільйонах байтів, із запасом на обгортку multipart; упритул до обриву — це знову лотерея. Перевірку на обрізане тіло, яка лікувала TM-001245, пряме завантаження не скасовує: після нього PATCH у тому ж роуті питає сховище, скільки байтів там насправді лежить.

17. **Заявка з дизайнером мусить знати свій товар, а їх вісім дверей** (Diana, 2026-09-17). Правило: **кожен перехід на `/order` несе товар в АДРЕСІ, а не тільки в `sessionStorage`.** Сховище вкладки порожнє в новій вкладці, його не видно після «відкрити в Safari» з вбудованого браузера Інстаграма, і воно стирається після успішної відправки. Дверей вісім: картка товару, сторінки фотокниги і журналу A4, і п'ять конструкторів (магніти, постери, друк, пазли, календарі), які роблять просте перенаправлення. Сім із них не передавали нічого, а сторінки фотокниги і журналу ще й викидали розмір, кількість сторінок і ціну, які людина щойно обрала рядком вище — кнопка конструктора передавала їх усі, кнопка дизайнера жодної. Складання обох джерел — у `lib/orders/designer-config.ts`. Де позицій кілька (А5 чи А4, настільний чи настінний), slug НЕ вигадується: записати товар, якого людина не обирала, гірше, ніж чесно лишити поле порожнім, а назва категорії все одно каже менеджерці, про що питати. Додаючи дев'яті двері, шукай `push('/order` без параметрів.

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
