const BASE_URL = (process.env.ZQ_BASE_URL || 'https://system.zqdropshipping.com/api/v2').replace(/\/$/, '');

function apiKey() {
  if (!process.env.ZQ_API_KEY) {
    const err = new Error('ZQ_API_KEY is not configured.');
    err.code = 'ZQ_NOT_CONFIGURED';
    throw err;
  }
  return process.env.ZQ_API_KEY;
}

async function zqFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-API-Key': apiKey(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });

  let body;
  try { body = await response.json(); } catch { body = null; }

  if (!response.ok || !body || body.code !== 200) {
    const err = new Error(body?.message || `ZQ API request failed (${response.status}).`);
    err.status = response.status;
    err.payload = body;
    throw err;
  }
  return body.data;
}

export const zq = {
  createOrder(orders) {
    const payload = Array.isArray(orders) ? orders : [orders];
    return zqFetch('/openapi/order/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getOrderDetail(platformOrderId) {
    return zqFetch(`/openapi/order/detail/${encodeURIComponent(platformOrderId)}`);
  },

  getTracking(platformOrderId) {
    return zqFetch(`/openapi/order/tracking/${encodeURIComponent(platformOrderId)}`);
  },

  getInventory(sku) {
    return zqFetch(`/openapi/order/inventory/${encodeURIComponent(sku)}`);
  },

  listImportProducts(params = {}) {
    return zqFetch('/openapi/import_product/list', {
      method: 'POST',
      body: JSON.stringify({
        cursor: params.cursor ?? null,
        size: Math.min(Number(params.size || 20), 100),
        ...(params.keyword ? { keyword: params.keyword } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.sourceType?.length ? { sourceType: params.sourceType } : {}),
        ...(params.ids?.length ? { ids: params.ids } : {})
      })
    });
  },

  getImportProduct(id) {
    return zqFetch(`/openapi/import_product/${encodeURIComponent(id)}`);
  },

  getInternationalShipping({ countryCode, fromCountryCode = 'CN', weight, quantity = 1, attributeName = 'GENERAL' }) {
    const q = new URLSearchParams({
      countryCode,
      fromCountryCode,
      weight: String(weight),
      quantity: String(quantity),
      attributeName: String(attributeName)
    });
    return zqFetch(`/openapi/international_shipping_cost/get?${q}`);
  },

  getSeaShippingCountries() {
    return zqFetch('/openapi/international_shipping_cost/sea_shipping/countryCodeList');
  },

  calculateSeaShipping(payload) {
    return zqFetch('/openapi/international_shipping_cost/sea_shipping/calculate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getSeaShippingSurcharges() {
    return zqFetch('/openapi/international_shipping_cost/sea_shipping/surcharges');
  }
};
