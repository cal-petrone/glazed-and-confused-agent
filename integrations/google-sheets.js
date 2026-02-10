/**
 * Google Sheets Integration
 * Logs orders directly to a Google Sheet
 * for Glazed and Confused donut shop
 * 
 * Setup Instructions:
 * 1. Go to Google Cloud Console (https://console.cloud.google.com/)
 * 2. Create a new project or select existing
 * 3. Enable Google Sheets API
 * 4. Create Service Account credentials
 * 5. Download JSON key file
 * 6. Share your Google Sheet with the service account email
 * 7. Add to .env: GOOGLE_SHEETS_CREDENTIALS_PATH=./path/to/credentials.json
 * 8. Add to .env: GOOGLE_SHEETS_ID=your-spreadsheet-id
 */

const { google } = require('googleapis');
const path = require('path');

let sheetsClient = null;
let spreadsheetId = null;

/**
 * Calculate order totals - SINGLE SOURCE OF TRUTH
 * Used by both spoken confirmation and Google Sheets logging
 * @param {Array} items - Order items array with price and quantity
 * @param {number} taxRate - Tax rate (default 0.08 for 8% tax)
 * @returns {Object} { subtotal, tax, total }
 */
function calculateOrderTotals(items, taxRate = 0.08) {
  if (!items || items.length === 0) {
    return { subtotal: 0, tax: 0, total: 0 };
  }
  
  let subtotal = 0;
  items.forEach(item => {
    let itemTotal = 0;
    if (item.lineTotal !== undefined && item.lineTotal !== null) {
      itemTotal = parseFloat(item.lineTotal) || 0;
    } else {
      const unitPrice = parseFloat(item.unitPrice || item.price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      itemTotal = unitPrice * quantity;
      
      item.lineTotal = itemTotal;
      if (!item.unitPrice && item.price) {
        item.unitPrice = parseFloat(item.price);
      }
    }
    subtotal += itemTotal;
  });
  
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

/**
 * Compute final total from order items - SINGLE SOURCE OF TRUTH
 * @param {Array} orderItems - Order items with unitPrice and quantity
 * @returns {number} Final total (including tax)
 */
function computeFinalTotal(orderItems) {
  if (!orderItems || orderItems.length === 0) {
    return 0;
  }
  
  const totals = calculateOrderTotals(orderItems, 0.08);
  return totals.total;
}

/**
 * Initialize Google Sheets client
 */
async function initializeGoogleSheets() {
  const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  const credentialsBase64 = process.env.GOOGLE_SHEETS_CREDENTIALS_BASE64;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  
  if ((!credentialsPath && !credentialsBase64) || !sheetId) {
    console.log('⚠ Google Sheets not configured - skipping initialization');
    return false;
  }
  
  try {
    let auth;
    const fs = require('fs');
    
    // Option 1: Use base64 encoded credentials (for Railway/cloud deployments)
    if (credentialsBase64) {
      console.log('📁 Loading Google Sheets credentials from base64 environment variable');
      try {
        const cleanedBase64 = credentialsBase64.trim().replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
        
        if (!cleanedBase64 || cleanedBase64.length < 100) {
          console.error('✗ Base64 credentials string is too short or empty');
          return false;
        }
        
        let credentialsJson;
        try {
          credentialsJson = Buffer.from(cleanedBase64, 'base64').toString('utf-8');
        } catch (decodeError) {
          console.error('✗ Failed to decode base64 string:', decodeError.message);
          return false;
        }
        
        if (!credentialsJson || credentialsJson.trim().length === 0) {
          console.error('✗ Decoded base64 string is empty');
          return false;
        }
        
        let credentials;
        try {
          credentials = JSON.parse(credentialsJson);
        } catch (parseError) {
          console.error('✗ Failed to parse JSON from decoded base64:', parseError.message);
          return false;
        }
        
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email', 'client_id'];
        const missingFields = requiredFields.filter(field => !credentials[field]);
        if (missingFields.length > 0) {
          console.error('✗ Missing required credential fields:', missingFields.join(', '));
          return false;
        }
        
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        console.log('✓ Base64 credentials decoded and validated successfully');
      } catch (error) {
        console.error('✗ Failed to process base64 credentials:', error.message);
        return false;
      }
    } 
    // Option 2: Use file path (for local development)
    else if (credentialsPath) {
      const credentialsAbsolutePath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.resolve(__dirname, '..', credentialsPath.replace(/^\.\//, ''));
      
      console.log('📁 Loading Google Sheets credentials from:', credentialsAbsolutePath);
      
      if (!fs.existsSync(credentialsAbsolutePath)) {
        console.error('✗ Credentials file not found:', credentialsAbsolutePath);
        return false;
      }
      
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsAbsolutePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } else {
      console.error('✗ No credentials provided (neither path nor base64)');
      return false;
    }
    
    sheetsClient = google.sheets({ version: 'v4', auth });
    spreadsheetId = sheetId;
    
    console.log('✓ Google Sheets initialized');
    return true;
  } catch (error) {
    console.error('✗ Error initializing Google Sheets:', error.message);
    return false;
  }
}

/**
 * Format phone number as (123) 456-0987
 */
function formatPhoneNumber(phone) {
  if (!phone) {
    return 'Unknown';
  }
  
  const phoneStr = String(phone).toLowerCase().trim();
  
  if (phoneStr.includes('anonymous') || phoneStr.includes('blocked') || 
      phoneStr.includes('restricted') || phoneStr.includes('private') ||
      phoneStr === 'undefined' || phoneStr === 'null') {
    return 'Blocked';
  }
  
  const digits = String(phone).replace(/\D/g, '');
  
  let cleanDigits = digits;
  if (digits.length === 11 && digits.startsWith('1')) {
    cleanDigits = digits.slice(1);
  }
  
  if (cleanDigits.length !== 10) {
    return phone || 'Unknown';
  }
  
  return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
}

/**
 * Log order to Google Sheets
 * @param {Object} order - Order object with items, totals, etc.
 * @param {Object} storeConfig - Store configuration (name, location, etc.)
 */
async function logOrderToGoogleSheets(order, storeConfig = {}) {
  if (!sheetsClient || !spreadsheetId) {
    console.log('⚠ Google Sheets not configured - skipping order log');
    return false;
  }
  
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!order.items || order.items.length === 0) {
        console.error('❌ ERROR: Order has no items - cannot calculate total');
        return false;
      }
      
      // Use SINGLE SOURCE OF TRUTH for totals
      let totals;
      let finalTotalValue;
      
      if (order.finalTotal !== undefined && typeof order.finalTotal === 'number' && order.finalTotal > 0) {
        finalTotalValue = order.finalTotal;
        const taxRate = parseFloat(storeConfig.taxRate) || 0.08;
        const subtotal = finalTotalValue / (1 + taxRate);
        const tax = finalTotalValue - subtotal;
        totals = {
          subtotal: Math.round(subtotal * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          total: finalTotalValue
        };
      } else if (order.totals && typeof order.totals.total === 'number') {
        totals = order.totals;
        finalTotalValue = totals.total;
      } else {
        const taxRate = parseFloat(storeConfig.taxRate) || 0.08;
        totals = calculateOrderTotals(order.items, taxRate);
        finalTotalValue = totals.total;
        order.totals = totals;
        order.finalTotal = finalTotalValue;
      }
      
      // Format items string
      const itemsString = order.items.map(item => {
        const qty = item.quantity || 1;
        const name = item.name || 'Unknown Item';
        const size = item.size && item.size !== 'single' && item.size !== 'regular' ? `${item.size} ` : '';
        const mods = item.specialInstructions ? ` [${item.specialInstructions}]` : '';
        return `${qty}x ${size}${name}${mods}`;
      }).join('; ');
      
      // Helper function to capitalize first letter of each word
      const capitalizeWords = (str) => {
        if (!str || typeof str !== 'string') return str;
        return str.trim().split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      };
      
      // Format phone number
      if (!order.customerPhone || order.customerPhone === 'null' || order.customerPhone === 'undefined') {
        order.customerPhone = 'Unknown';
      }
      const phoneNumber = formatPhoneNumber(order.customerPhone);
      const finalPhoneForSheet = phoneNumber || 'Unknown';
      
      // Normalize delivery method
      let normalizedDeliveryMethod = 'Pickup';
      const deliveryMethodRaw = order.deliveryMethod ? String(order.deliveryMethod).trim().toLowerCase() : '';
      if (deliveryMethodRaw.includes('deliver')) {
        normalizedDeliveryMethod = 'Delivery';
      } else if (deliveryMethodRaw === 'pickup' || deliveryMethodRaw === 'pick up' || deliveryMethodRaw === 'pick-up') {
        normalizedDeliveryMethod = 'Pickup';
      }
      
      // Determine address
      let validatedAddress;
      if (normalizedDeliveryMethod === 'Pickup') {
        validatedAddress = 'N/A';
      } else {
        validatedAddress = (order.address && order.address.trim().length > 0)
          ? capitalizeWords(order.address.trim())
          : 'Address not provided';
      }
      
      // Calculate estimated pickup time
      let estimatedMinutes = 10; // Base for donut shop (faster than pizza)
      const itemCount = order.items.length;
      if (itemCount > 3) {
        estimatedMinutes += (itemCount - 3) * 2;
      }
      // Add time for dozen orders (more prep)
      const dozenCount = order.items.filter(item => item.size === 'dozen').length;
      if (dozenCount > 0) {
        estimatedMinutes += dozenCount * 3;
      }
      if (order.deliveryMethod === 'delivery') {
        estimatedMinutes += 10;
      }
      estimatedMinutes = Math.max(10, Math.ceil(estimatedMinutes / 5) * 5);
      
      const now = new Date();
      const estimatedPickupTime = new Date(now.getTime() + estimatedMinutes * 60000);
      const pickupTimeString = estimatedPickupTime.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Build row: Name, Phone, Method, Address, Time, Price, Order Details
      const row = [
        capitalizeWords(order.customerName) || 'Not Provided',
        finalPhoneForSheet,
        normalizedDeliveryMethod,
        validatedAddress,
        pickupTimeString,
        `$${finalTotalValue.toFixed(2)}`,
        capitalizeWords(itemsString) || 'No Items'
      ];
      
      console.log('📝 Logging order to Google Sheets:', row);
      
      // Append to sheet
      const response = await sheetsClient.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A:G',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [row],
        },
      });
      
      console.log('✓ Order logged to Google Sheets:', response.data.updates.updatedCells, 'cells updated');
      return true;
    } catch (error) {
      lastError = error;
      
      const isRetryable = 
        error.code === 502 || error.code === 503 || error.code === 429 ||
        error.message?.includes('502') || error.message?.includes('503') ||
        error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT');
      
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`⚠ Google Sheets API error (attempt ${attempt}/${maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        console.error('✗ Error logging to Google Sheets:', error.message);
        return false;
      }
    }
  }
  
  console.error('✗ Failed to log to Google Sheets after', maxRetries, 'attempts');
  return false;
}

/**
 * Create header row if sheet is empty
 */
async function initializeSheetHeaders() {
  if (!sheetsClient || !spreadsheetId) {
    return false;
  }
  
  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Sheet1!A1:G1',
    });
    
    if (!response.data.values || response.data.values.length === 0) {
      const headers = [
        'Name',
        'Phone Number',
        'Pick Up/Delivery',
        'Delivery Address',
        'Estimated Pick Up Time (EST)',
        'Price',
        'Order Details',
      ];
      
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1:G1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers],
        },
      });
      
      console.log('✓ Google Sheets headers created');
    } else {
      console.log('✓ Google Sheets headers already exist');
    }
  } catch (error) {
    console.warn('⚠️  Could not initialize sheet headers:', error.message);
  }
}

module.exports = {
  calculateOrderTotals,
  computeFinalTotal,
  initializeGoogleSheets,
  logOrderToGoogleSheets,
  initializeSheetHeaders,
  formatPhoneNumber,
};
