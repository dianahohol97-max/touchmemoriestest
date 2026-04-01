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
| `TELEGRAM_PUBLIC_BOT_TOKEN` | Telegram notifications |
| `TELEGRAM_DESIGNER_CHAT_ID` | Designer chat ID |
| `CRON_SECRET` | Secret for cron job auth |
| `CHECKBOX_LOGIN` | Checkbox ПРРО login |
| `CHECKBOX_LICENSE_KEY` | Checkbox license key |
