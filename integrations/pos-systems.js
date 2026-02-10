/**
 * POS System Integrations
 * Supports Square, Toast, and Clover POS systems via REST APIs
 * for Glazed and Confused donut shop
 * 
 * MENU ITEM MAPPING:
 * Menu items must be mapped to POS Item IDs in Google Sheets:
 * - Column F: Square Item ID
 * - Column G: Toast Item ID
 * - Column H: Clover Item ID
 * 
 * Setup Instructions:
 * 
 * SQUARE:
 * 1. Go to Square Developer Dashboard (https://developer.squareup.com/)
 * 2. Create an application
 * 3. Get your Access Token and Location ID
 * 4. Add to .env:
 *    - POS_SYSTEM=square
 *    - SQUARE_ACCESS_TOKEN=your-access-token
 *    - SQUARE_LOCATION_ID=your-location-id
 *    - SQUARE_ENVIRONMENT=sandbox (or production)
 * 
 * TOAST:
 * 1. Go to Toast API Portal
 * 2. Get your API credentials
 * 3. Add to .env:
 *    - POS_SYSTEM=toast
 *    - TOAST_API_KEY=your-api-key
 *    - TOAST_RESTAURANT_ID=your-restaurant-id
 * 
 * CLOVER:
 * 1. Go to Clover Developer Portal (https://dev.clover.com/)
 * 2. Create an application
 * 3. Get your API Token and Merchant ID
 * 4. Add to .env:
 *    - POS_SYSTEM=clover
 *    - CLOVER_API_TOKEN=your-api-token
 *    - CLOVER_MERCHANT_ID=your-merchant-id
 *    - CLOVER_ENVIRONMENT=production (or sandbox)
 */

const { Client, Environment } = require('squareup');

let squareClient = null;
let squareLocationId = null;

/**
 * Initialize Square POS client
 */
function initializeSquare() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
  
  if (!accessToken || !locationId) {
    console.log('⚠ Square POS not configured - skipping initialization');
    return false;
  }
  
  try {
    squareClient = new Client({
      accessToken: accessToken,
      environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
    });
    
    squareLocationId = locationId;
    console.log('✓ Square POS initialized');
    return true;
  } catch (error) {
    console.error('✗ Error initializing Square POS:', error.message);
    return false;
  }
}

/**
 * Create order in Square POS
 */
async function createSquareOrder(order, storeConfig = {}, menuCache = null) {
  if (!squareClient || !squareLocationId) {
    console.log('⚠ Square POS not configured - skipping order creation');
    return false;
  }
  
  try {
    const lineItems = order.items.map(item => {
      const menuItem = menuCache?.menu?.[item.name.toLowerCase()];
      const squareItemId = menuItem?.squareItemId;
      
      if (!squareItemId) {
        console.warn(`⚠ No Square Item ID mapped for "${item.name}" - creating custom item`);
        return {
          name: `${item.size || ''} ${item.name}`.trim(),
          quantity: (item.quantity || 1).toString(),
          basePriceMoney: {
            amount: Math.round((item.price || item.unitPrice || 0) * 100),
            currency: 'USD',
          },
        };
      }
      
      return {
        catalogObjectId: squareItemId,
        quantity: (item.quantity || 1).toString(),
      };
    });
    
    const requestBody = {
      idempotencyKey: order.streamSid || `order-${Date.now()}`,
      order: {
        locationId: squareLocationId,
        lineItems: lineItems,
        ...(order.customerName ? { customerId: order.customerId } : {}),
      },
    };
    
    const { result } = await squareClient.ordersApi.createOrder(requestBody);
    console.log('✓ Order created in Square:', result.order.id);
    return result.order.id;
  } catch (error) {
    console.error('✗ Error creating Square order:', error.message);
    return false;
  }
}

/**
 * Create order in Toast POS
 */
async function createToastOrder(order, storeConfig = {}, menuCache = null) {
  const apiKey = process.env.TOAST_API_KEY;
  const restaurantId = process.env.TOAST_RESTAURANT_ID;
  
  if (!apiKey || !restaurantId) {
    console.log('⚠ Toast POS not configured - skipping order creation');
    return false;
  }
  
  try {
    const items = order.items.map(item => {
      const menuItem = menuCache?.menu?.[item.name.toLowerCase()];
      const toastItemId = menuItem?.toastItemId;
      
      return {
        menuItemId: toastItemId || null,
        quantity: item.quantity || 1,
        name: `${item.size || ''} ${item.name}`.trim(),
      };
    });
    
    const orderData = {
      restaurantId: restaurantId,
      orderType: order.deliveryMethod === 'delivery' ? 'DELIVERY' : 'PICKUP',
      items: items,
      customer: {
        phone: order.customerPhone || order.from || '',
        name: order.customerName || '',
      },
      ...(order.deliveryMethod === 'delivery' && order.address ? {
        deliveryAddress: order.address,
      } : {}),
    };
    
    const response = await fetch(`https://api.toasttab.com/v1/restaurants/${restaurantId}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Order created in Toast:', result.orderId || result.id);
      return result.orderId || result.id;
    } else {
      const errorText = await response.text();
      console.error('✗ Toast API error:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('✗ Error creating Toast order:', error.message);
    return false;
  }
}

/**
 * Create order in Clover POS
 */
async function createCloverOrder(order, storeConfig = {}, menuCache = null) {
  const apiToken = process.env.CLOVER_API_TOKEN;
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const environment = process.env.CLOVER_ENVIRONMENT || 'production';
  
  if (!apiToken || !merchantId) {
    console.log('⚠ Clover POS not configured - skipping order creation');
    return false;
  }
  
  try {
    const lineItems = order.items.map(item => {
      const menuItem = menuCache?.menu?.[item.name.toLowerCase()];
      const cloverItemId = menuItem?.cloverItemId;
      
      if (!cloverItemId) {
        return {
          name: `${item.size || ''} ${item.name}`.trim(),
          price: Math.round((item.price || item.unitPrice || 0) * 100),
          quantity: item.quantity || 1,
        };
      }
      
      return {
        id: cloverItemId,
        quantity: item.quantity || 1,
      };
    });
    
    const baseUrl = environment === 'sandbox' 
      ? 'https://sandbox.dev.clover.com'
      : 'https://api.clover.com';
    
    const orderData = {
      merchant: merchantId,
      items: lineItems,
      currency: 'USD',
      ...(order.customerName ? { customer: { name: order.customerName } } : {}),
      ...(order.customerPhone ? { customer: { phone: order.customerPhone } } : {}),
      ...(order.deliveryMethod === 'delivery' && order.address ? {
        deliveryAddress: order.address
      } : {}),
    };
    
    const response = await fetch(`${baseUrl}/v3/merchants/${merchantId}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✓ Order created in Clover:', result.id);
      return result.id;
    } else {
      const errorText = await response.text();
      console.error('✗ Clover API error:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('✗ Error creating Clover order:', error.message);
    return false;
  }
}

/**
 * Send order to configured POS system
 */
async function sendOrderToPOS(order, storeConfig = {}, menuCache = null) {
  const posSystem = process.env.POS_SYSTEM || 'none';
  
  if (!order || !order.items || order.items.length === 0) {
    console.warn('⚠ Cannot send to POS: Order has no items');
    return false;
  }
  
  console.log(`📤 Sending order to ${posSystem.toUpperCase()} POS:`, {
    itemCount: order.items.length,
    items: order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
    deliveryMethod: order.deliveryMethod || 'not specified',
    customerName: order.customerName || 'not provided'
  });
  
  switch (posSystem.toLowerCase()) {
    case 'square':
      return await createSquareOrder(order, storeConfig, menuCache);
    case 'toast':
      return await createToastOrder(order, storeConfig, menuCache);
    case 'clover':
      return await createCloverOrder(order, storeConfig, menuCache);
    default:
      console.log('⚠ No POS system configured (POS_SYSTEM env var not set)');
      return false;
  }
}

/**
 * Initialize all POS systems
 */
function initializePOS() {
  initializeSquare();
}

module.exports = {
  initializePOS,
  sendOrderToPOS,
  createSquareOrder,
  createToastOrder,
  createCloverOrder,
};
