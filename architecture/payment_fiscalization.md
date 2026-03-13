# SOP: Payment & Fiscalization Flow

## Goal
Automate the creation of a fiscal receipt via Checkbox within 30 seconds of a successful Monobank payment.

## Inputs
- Monobank Webhook Payload (Invoice status: `success`)
- Order Data (from Supabase)

## Logic
1. **Webhook Reception:**
   - Listen for POST requests from Monobank.
   - Verify ECDSA signature.
   - Extract `invoiceId` and `status`.

2. **Order Verification:**
   - Query Supabase `orders` for the `payment_id == invoiceId`.
   - Ensure order status is not already `paid`.

3. **Fiscalization (Checkbox):**
   - Check if a cash shift is open for the merchant. If not, open it (`POST /api/v1/shifts`).
   - Create a "sell" receipt (`POST /api/v1/receipts/sell`).
   - Map order items to Checkbox goods.
   - Add customer email to receipt for automatic sending.

4. **Status Update:**
   - Update order status in Supabase to `paid`.
   - Store `fiscal_receipt_id` in the order record.

## Edge Cases
- **Monobank Webhook Failure:** Implement a "Poll" fallback tool to check status manually if webhook is delayed.
- **Checkbox API Down:** Retry logic with exponential backoff (max 3 retries within 30s window).
- **Shift Not Opened:** Ensure shift management is atomic and handles multiple concurrent orders.
