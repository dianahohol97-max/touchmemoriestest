/**
 * Nova Poshta API Integration
 * API Documentation: https://devcenter.novaposhta.ua/docs/services/
 */

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

export interface NovaPoshtaConfig {
  apiKey: string;
  senderCityRef: string;
  senderWarehouseRef: string;
  senderContactPerson: string;
  senderPhone: string;
}

export interface CreateTTNParams {
  recipientName: string;
  recipientPhone: string;
  recipientCityRef: string;
  recipientWarehouseRef: string;
  weight: number; // kg
  cost: number; // UAH
  description: string;
  orderRef: string; // Your order ID
  paymentMethod?: 'Cash' | 'NonCash';
  payerType?: 'Recipient' | 'Sender';
  serviceType?: 'WarehouseWarehouse' | 'WarehouseDoors' | 'DoorsWarehouse' | 'DoorsDoors';
  cargoType?: 'Parcel' | 'Cargo';
  seatsAmount?: number;
}

export interface TTNResponse {
  success: boolean;
  ttn?: string;
  ref?: string;
  costOnSite?: number;
  estimatedDeliveryDate?: string;
  error?: string;
  errors?: string[];
}

export interface TrackingInfo {
  ttn: string;
  status: string;
  statusCode: number;
  city?: string;
  warehouse?: string;
  scheduledDeliveryDate?: string;
  actualDeliveryDate?: string;
  recipientName?: string;
  weight?: number;
  cost?: number;
  rawData?: any;
}

export interface CitySearchResult {
  ref: string;
  description: string;
  descriptionRu: string;
  area: string;
}

export interface WarehouseSearchResult {
  ref: string;
  description: string;
  descriptionRu: string;
  number: string;
  cityRef: string;
}

/**
 * Make API request to Nova Poshta
 */
async function makeNovaPoshtaRequest(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: any
): Promise<any> {
  try {
    const response = await fetch(NP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.join(', ') || 'Nova Poshta API error');
    }

    return data;
  } catch (error: any) {
    console.error('Nova Poshta API error:', error);
    throw error;
  }
}

/**
 * Create Internet Document (TTN)
 */
export async function createTTN(
  config: NovaPoshtaConfig,
  params: CreateTTNParams
): Promise<TTNResponse> {
  try {
    const data = await makeNovaPoshtaRequest(
      config.apiKey,
      'InternetDocument',
      'save',
      {
        PayerType: params.payerType || 'Recipient',
        PaymentMethod: params.paymentMethod || 'Cash',
        DateTime: new Date().toISOString().split('T')[0],
        CargoType: params.cargoType || 'Parcel',
        Weight: params.weight.toString(),
        ServiceType: params.serviceType || 'WarehouseWarehouse',
        SeatsAmount: (params.seatsAmount || 1).toString(),
        Description: params.description,
        Cost: params.cost.toString(),
        CitySender: config.senderCityRef,
        Sender: config.senderWarehouseRef,
        SenderAddress: config.senderWarehouseRef,
        ContactSender: config.senderContactPerson,
        SendersPhone: config.senderPhone,
        CityRecipient: params.recipientCityRef,
        Recipient: params.recipientName,
        RecipientAddress: params.recipientWarehouseRef,
        ContactRecipient: params.recipientName,
        RecipientsPhone: params.recipientPhone,
        InfoRegClientBarcodes: params.orderRef,
      }
    );

    const docData = data.data[0];

    return {
      success: true,
      ttn: docData.IntDocNumber,
      ref: docData.Ref,
      costOnSite: parseFloat(docData.CostOnSite || '0'),
      estimatedDeliveryDate: docData.EstimatedDeliveryDate,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Track shipment by TTN
 */
export async function trackShipment(
  apiKey: string,
  ttn: string
): Promise<TrackingInfo | null> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'TrackingDocument',
      'getStatusDocuments',
      {
        Documents: [
          {
            DocumentNumber: ttn,
          },
        ],
      }
    );

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const trackData = data.data[0];

    return {
      ttn,
      status: trackData.Status || '',
      statusCode: parseInt(trackData.StatusCode || '0'),
      city: trackData.CityRecipient || '',
      warehouse: trackData.WarehouseRecipient || '',
      scheduledDeliveryDate: trackData.ScheduledDeliveryDate || '',
      actualDeliveryDate: trackData.ActualDeliveryDate || '',
      recipientName: trackData.RecipientFullName || '',
      weight: parseFloat(trackData.DocumentWeight || '0'),
      cost: parseFloat(trackData.DocumentCost || '0'),
      rawData: trackData,
    };
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return null;
  }
}

/**
 * Search cities by name
 */
export async function searchCities(
  apiKey: string,
  query: string
): Promise<CitySearchResult[]> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'Address',
      'searchSettlements',
      {
        CityName: query,
        Limit: 10,
      }
    );

    return (
      data.data[0]?.Addresses?.map((city: any) => ({
        ref: city.DeliveryCity,
        description: city.Present,
        descriptionRu: city.Present,
        area: city.Area || '',
      })) || []
    );
  } catch (error) {
    console.error('Error searching cities:', error);
    return [];
  }
}

/**
 * Get warehouses in city
 */
export async function getWarehouses(
  apiKey: string,
  cityRef: string
): Promise<WarehouseSearchResult[]> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'Address',
      'getWarehouses',
      {
        CityRef: cityRef,
        Limit: 100,
      }
    );

    return (
      data.data?.map((warehouse: any) => ({
        ref: warehouse.Ref,
        description: warehouse.Description,
        descriptionRu: warehouse.DescriptionRu,
        number: warehouse.Number,
        cityRef: warehouse.CityRef,
      })) || []
    );
  } catch (error) {
    console.error('Error getting warehouses:', error);
    return [];
  }
}

/**
 * Delete Internet Document
 */
export async function deleteTTN(apiKey: string, ref: string): Promise<boolean> {
  try {
    await makeNovaPoshtaRequest(apiKey, 'InternetDocument', 'delete', {
      DocumentRefs: ref,
    });
    return true;
  } catch (error) {
    console.error('Error deleting TTN:', error);
    return false;
  }
}

/**
 * Get printable document (label)
 */
export async function getPrintableDocument(
  apiKey: string,
  ttns: string[],
  type: 'pdf' | 'zebra' = 'pdf'
): Promise<{ url?: string; error?: string }> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'InternetDocument',
      'printDocument',
      {
        DocumentRefs: ttns,
        Type: type,
      });

    return {
      url: data.data[0]?.link || data.data[0],
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

/**
 * Calculate shipping cost
 */
export async function calculateShippingCost(
  apiKey: string,
  params: {
    citySenderRef: string;
    cityRecipientRef: string;
    weight: number;
    serviceType?: string;
    cost?: number;
  }
): Promise<{ cost: number; error?: string }> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'InternetDocument',
      'getDocumentPrice',
      {
        CitySender: params.citySenderRef,
        CityRecipient: params.cityRecipientRef,
        Weight: params.weight.toString(),
        ServiceType: params.serviceType || 'WarehouseWarehouse',
        Cost: (params.cost || 100).toString(),
      }
    );

    return {
      cost: parseFloat(data.data[0]?.Cost || '0'),
    };
  } catch (error: any) {
    return {
      cost: 0,
      error: error.message,
    };
  }
}

/**
 * Get delivery date estimate
 */
export async function getDeliveryDate(
  apiKey: string,
  params: {
    citySenderRef: string;
    cityRecipientRef: string;
    serviceType?: string;
  }
): Promise<{ date?: string; error?: string }> {
  try {
    const data = await makeNovaPoshtaRequest(
      apiKey,
      'InternetDocument',
      'getDocumentDeliveryDate',
      {
        CitySender: params.citySenderRef,
        CityRecipient: params.cityRecipientRef,
        ServiceType: params.serviceType || 'WarehouseWarehouse',
        DateTime: new Date().toISOString().split('T')[0],
      }
    );

    return {
      date: data.data[0]?.DeliveryDate?.date || '',
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}
