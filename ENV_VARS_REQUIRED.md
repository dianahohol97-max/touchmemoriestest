# Required Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables

## 🔴 CRITICAL (site won't work without these)

| Variable | Description | Where to get |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase → Settings → API |

## 🟡 PAYMENT (checkout won't process payments without these)

| Variable | Description | Where to get |
|---|---|---|
| `MONOBANK_TOKEN` | Monobank merchant token (UA) | Monobank Business → API |
| `MONOBANK_TOKEN_INTL` | Monobank token for international cards | Monobank Business → API |

## 🟡 EMAIL (notifications won't send)

| Variable | Description | Where to get |
|---|---|---|
| `BREVO_API_KEY` | Brevo (Sendinblue) API key | Brevo → Settings → API Keys |
| `BREVO_WEBHOOK_SECRET` | Shared secret for the delivery-status webhook. Generate a long random string yourself, put it here, and set the SAME value as the `x-webhook-secret` header on the Brevo webhook pointing at `POST /api/webhooks/brevo`. Brevo does not sign its webhooks, so this header is the only thing standing between the endpoint and the open internet — without the variable the route answers 503 and accepts nothing. Header only, never a URL parameter: URLs land in proxy logs. | You invent it; set the header in Brevo → Transactional → Settings → Webhook (or via the API `createWebhook` / `updateWebhook`) |

## 🟡 NOVA POSHTA (delivery tracking)

| Variable | Description | Where to get |
|---|---|---|
| `NOVA_POSHTA_API_KEY` | Nova Poshta API key | novaposhta.ua → Cabinet → API |
| `NOVA_POSHTA_SENDER_PHONE` | Sender phone | Your NP account phone |
| `NOVA_POSHTA_SENDER_REF` | Sender UUID | NP API → getSenders |
| `NOVA_POSHTA_SENDER_CITY` | Sender city name | e.g. "Тернопіль" |
| `NOVA_POSHTA_SENDER_WAREHOUSE` | Sender warehouse number | Your NP pickup point |

## 🟢 OPTIONAL

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI for chatbot |
| `TELEGRAM_PUBLIC_BOT_TOKEN` | Telegram notifications + the public chatbot (Софія) + Telegram Business monitoring of Diana's client dialogs |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token passed to Telegram setWebhook; the chatbot webhook refuses unsigned updates in production without it. Re-register via `POST /api/chatbot/telegram/setup` after changing |
| `TELEGRAM_DESIGNER_CHAT_ID` | Designer chat ID |
| `VERCEL_API_TOKEN` | Read-only Vercel token for `/api/cron/error-alerts`, which reads the production runtime log every fifteen minutes and posts 5xx responses to the work chat. Without it that cron answers 503 and stays silent — a monitor that quietly does nothing is worse than none. Create it in Vercel account settings → Tokens, scoped to this team. `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` are optional; the cron falls back to the ids recorded in CLAUDE.md |
| `CRON_SECRET` | Secret for cron job auth |
| `OPS_DIGEST_EMAIL` | Where the twice-daily "що потребує уваги" report is sent. Comma-separated for several recipients; without it the digest job runs but delivers nothing |
| `KEYCRM_API_TOKEN` | KeyCRM API key. Used by the CRM contact import, the ops digest, and the order sync |
| `KEYCRM_SYNC_ENABLED` | Set to `true` to let the sync actually create orders in KeyCRM. Anything else keeps it in read-only/dry-run mode, so deploying the code never starts writing on its own |
| `KEYCRM_SYNC_FROM` | ISO date/time the sync takes over, in UTC — for "from 11 Aug 2026, Kyiv midnight" that is `2026-08-10T21:00:00Z`. Orders paid before it are never pushed — they were entered by hand and pushing them would duplicate. Without this variable the sync transfers nothing at all |
| `KEYCRM_SOURCE_ID` | Numeric id of the "Сайт" order source in KeyCRM. Required to create orders — look it up via `GET /api/admin/keycrm` |
| `KEYCRM_PAYMENT_METHOD_ID` | Fallback payment-method id used when none of the specific ones below is set. When nothing is set at all, the payment block is omitted rather than guessed |
| `KEYCRM_PAYMENT_METHOD_FULL_ID` | Method id for fully paid orders («повна оплата») |
| `KEYCRM_PAYMENT_METHOD_PREPAID_ID` | Method id for the prepayment of cash-on-delivery orders («передоплата») |
| `KEYCRM_PAYMENT_METHOD_COD_ID` | Method id for the balance collected on delivery («післяплата»), filed when the parcel is delivered |
| `KEYCRM_DELIVERY_SERVICE_ID` | Optional. Same idea for the courier — omitted unless configured |
| `NEXT_PUBLIC_KEYCRM_ORDER_URL` | URL template for the «Відкрити в KeyCRM» button on the order page. Copy any real order URL from your CRM and replace the number with `{id}`, e.g. `https://<акаунт>.keycrm.app/app/orders/{id}` |
| `CHECKBOX_LOGIN` | Checkbox ПРРО login |
| `CHECKBOX_LICENSE_KEY` | Checkbox license key |
| `R2_ACCOUNT_ID` | Cloudflare account id — enables R2 for gallery files |
| `R2_ACCESS_KEY_ID` | R2 API token key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | R2 bucket name for gallery photos/videos |
| `R2_PUBLIC_BASE_URL` | Public bucket URL (r2.dev or custom domain) |
| `R2_JURISDICTION` | Only for jurisdiction-restricted buckets: `eu`. Omit otherwise |
