---
name: nova-poshta
description: Integration with Nova Poshta API for warehouse search, delivery cost calculation, TTN creation, and tracking.
---

# Nova Poshta Skill

This skill allows the agent to interact with the Nova Poshta API to manage delivery logistics.

## Configuration
The skill requires `NOVA_POSHTA_API_KEY` to be set in the `.env` file.
API Endpoint: `https://api.novaposhta.ua/v2.0/json/`

## Instructions

### 1. Search Warehouses by City
To find warehouses in a specific city, use the `Address/getWarehouses` method.
- **Model:** `Address`
- **Method:** `getWarehouses`
- **Properties:** `{ "CityName": "Київ" }` (or `CityRef`)

### 2. Calculate Delivery Cost
To estimate the cost between two locations.
- **Model:** `InternetDocument`
- **Method:** `getDocumentPrice`
- **Properties:**
  - `CitySender`: UUID of sender city
  - `CityRecipient`: UUID of recipient city
  - `Weight`: decimal
  - `ServiceType`: e.g., "WarehouseWarehouse"
  - `Cost`: Declared value

### 3. Create TTN (Tracking Number)
To generate a new consignment note for an order.
- **Model:** `InternetDocument`
- **Method:** `save`
- **Properties:** Requires sender/recipient details, weight, volume, and payment type.

### 4. Track Shipment Status
To get the current status of a package.
- **Model:** `TrackingDocument`
- **Method:** `getStatusDocuments`
- **Properties:** `{ "Documents": [{ "DocumentNumber": "TTN_NUMBER" }] }`

## Implementation Details
The agent should use atomic Python or JS scripts in `tools/` to perform these operations, passing the `apiKey` in every request body.

```json
{
    "apiKey": "[YOUR_KEY]",
    "modelName": "ModelName",
    "calledMethod": "MethodName",
    "methodProperties": { ... }
}
```
