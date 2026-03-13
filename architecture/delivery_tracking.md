# SOP: Delivery & Tracking Flow

## Goal
Integrate Nova Poshta for TTN (Consignment Note) creation and real-time tracking.

## Inputs
- Order ID
- Customer Delivery Info (City, Warehouse/Address)

## Logic
1. **TTN Creation:**
   - Triggered by admin in CRM or automatically after payment (configurable).
   - Use `InternetDocument.save` method.
   - Validate address data using NP's `Address.getCities` and `Address.getWarehouses`.

2. **Tracking:**
   - Periodically poll `TrackingDocument.getStatusDocuments` for active TTNs.
   - Update order status in Supabase (e.g., `shipped`, `delivered`).

## Edge Cases
- **Invalid Address:** Provide UI feedback in checkout to ensure warehouse exists.
- **NP API Down:** Log error and allow admin to retry TTN creation manually from dashboard.
