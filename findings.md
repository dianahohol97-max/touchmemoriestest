# Findings & Discoveries

## Discovery Question Answers
- **North Star:** Complete Ukrainian e-commerce for photo books/products with auto-fiscalization.
- **Integrations:**
    - Monobank Acquiring (Payments)
    - Checkbox ПРРО (Fiscalization)
    - Nova Poshta (Delivery)
    - Supabase (DB/Storage)
    - Vercel (Hosting)
- **Source of Truth:** Supabase PostgreSQL.
- **Delivery Payload:** Public Next.js site, Admin CRM, Automation (Payment -> Fiscal Receipt).
- **Behavioral Rules:** Ukrainian UI, English Code, Mobile-first, SEO (SSR/ISR), 30s receipt generation, UAH.

## Research Findings
### Monobank Acquiring
- **API Host:** `api.monobank.ua`
- **Key Methods:** `PUT /v1/merchant/invoice/create`, `GET /v1/merchant/invoice/status`
- **Webhook:** Requires ECDSA signature verification. Supports `success`, `failure`, `reversed`.
- **Note:** Merchant must have a FOP account and a token.

### Checkbox ПРРО
- **API Host:** `api.checkbox.ua`
- **Key Methods:** `POST /api/v1/receipts/sell` (fiscalize), `POST /api/v1/shifts` (manage shifts).
- **Workflow:** Payment webhook -> Open shift (if closed) -> Create receipt -> Send to email.

### Nova Poshta
- **API Host:** `api.novaposhta.ua/v2.0/json/`
- **Key Methods:** `InternetDocument.save` (Create TTN), `TrackingDocument.getStatusDocuments` (Tracking).
- **Note:** Requires API Key from NP business account.

## Infrastructure Notes
- Framework: Next.js (Vercel)
- Database: Supabase PostgreSQL
- Storage: Supabase Storage
- Currency: UAH


