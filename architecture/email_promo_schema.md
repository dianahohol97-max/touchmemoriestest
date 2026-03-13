# Email Promo & Marketing Schema

## 1. `subscribers`
Tracks users who have opted into marketing emails.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Unique ID |
| email | text | UNIQUE, NOT NULL | Subscriber's email address |
| name | text | NULL | Subscriber's name |
| birthday_month | int | CHECK (1-12) | Optional birthday tracking |
| birthday_day | int | CHECK (1-31) | Optional birthday tracking |
| city | text | NULL | City for advanced segmentation |
| segments | text[] | DEFAULT '{}' | Tags like `['new', 'vip']` |
| source | text | CHECK (checkout, popup, manual, import) | Origin of subscription |
| is_active | boolean | DEFAULT true | Unsubscribe flag |
| unsubscribe_token | uuid | UNIQUE, DEFAULT gen_random_uuid() | Fast un-sub link token |
| subscribed_at | timestamptz | DEFAULT now() | Time joined |

## 2. `promo_codes`
Stores global discounts or customized individual offers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Unique ID |
| code | text | UNIQUE, NOT NULL | e.g. "SUMMER20" |
| type | text | CHECK (percent, fixed) | Discount logic |
| value | numeric | NOT NULL | Multiplier or subtraction sum |
| min_order_amount | numeric | DEFAULT 0 | Checkout limit threshold |
| applies_to | text | DEFAULT 'all' | 'all' or category_id |
| max_uses | int | NULL | Restricts campaign sizes |
| uses_count | int | DEFAULT 0 | Internal tracking |
| is_single_use_per_customer | boolean | DEFAULT true | Prevents multi-usage abuse |
| valid_from | timestamptz | DEFAULT now() | Start date |
| valid_until | timestamptz | NULL | End date |
| is_active | boolean | DEFAULT true | Hard-toggle limit |
| created_by | text | NULL | 'admin', 'birthday_auto' |
| notes | text | NULL | Internal admin memos |
| created_at | timestamptz | DEFAULT now() | Row creation timestamp |

## 3. `promo_code_usages`
Strictly controls preventing duplicate usages and records ledger.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Unique ID |
| promo_code_id | uuid | FK -> promo_codes.id (ON DELETE CASCADE) | The code utilized |
| customer_id | uuid | FK -> customers.id (ON DELETE CASCADE) | Who triggered it |
| order_id | uuid | FK -> orders.id (ON DELETE CASCADE) | The matched order |
| discount_amount | numeric | NOT NULL | Real resolved value saved |
| used_at | timestamptz | DEFAULT now() | Transaction timestamp |

## 4. `email_campaigns`
Broadcast logic and templates tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Unique ID |
| type | text | CHECK (new_product, promotion, birthday) | Origin categorization |
| subject | text | NOT NULL | Email Title |
| preview_text | text | NULL | Client-side preview line |
| html_body | text | NULL | Injected dynamic rich template |
| segment | text | DEFAULT 'all' | Targeted distribution slice |
| promo_code_id | uuid | FK -> promo_codes.id (ON DELETE SET NULL)| Specific attachment |
| product_id | uuid | FK -> products.id (ON DELETE SET NULL) | Specific attachment |
| status | text | CHECK (draft, scheduled, sending, sent) | Firing lifecycle |
| scheduled_at | timestamptz | NULL | Time to release |
| sent_at | timestamptz | NULL | Actual fired time |
| total_sent | int | DEFAULT 0 | Metric tracking |
| total_opened | int | DEFAULT 0 | Metric tracking |
| total_clicked | int | DEFAULT 0 | Metric tracking |
| created_at | timestamptz | DEFAULT now() | Row initialization |

## 5. `email_logs`
Granular line-items for single receiver dispatches linked to a master campaign.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Unique Tracking ID |
| campaign_id | uuid | FK -> email_campaigns.id (ON DELETE CASCADE) | Linked parent event |
| subscriber_id | uuid | FK -> subscribers.id (ON DELETE CASCADE) | Targeted prospect |
| email | text | NOT NULL | Address fired to |
| status | text | CHECK (sent, opened, clicked, bounced, unsubscribed) | Micro-status |
| sent_at | timestamptz | DEFAULT now() | Fired time |
| opened_at | timestamptz | NULL | Recorded read engagement time |
| tracking_pixel_id | uuid | UNIQUE, DEFAULT gen_random_uuid() | The query string attached to the image |
