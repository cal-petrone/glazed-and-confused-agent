/**
 * Google Sheets Integration
 * - Reads menu from the Menu sheet
 * - Logs completed orders to the Call Log sheet
 * for Glazed and Confused donut shop
 */

const { google } = require('googleapis');

let sheetsClient = null;

/**
 * Initialize Google Sheets client using base64 credentials or file path
 */
async function initializeGoogleSheets() {
  const credentialsBase64 = process.env.GOOGLE_SHEETS_CREDENTIALS_BASE64;

  if (!credentialsBase64) {
    console.log('⚠️  GOOGLE_SHEETS_CREDENTIALS_BASE64 not set — Google Sheets disabled');
    return false;
  }

  try {
    const cleanedBase64 = credentialsBase64.trim().replace(/\s/g, '');
    const credentialsJson = Buffer.from(cleanedBase64, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);

    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missing = requiredFields.filter(f => !credentials[f]);
    if (missing.length > 0) {
      console.error('❌ Google credentials missing fields:', missing.join(', '));
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets client initialized (service account:', credentials.client_email + ')');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets:', error.message);
    return false;
  }
}

/**
 * Fetch menu items from the Menu Google Sheet
 * Expects columns: Category | Item Name | Description | Price
 * Returns formatted menu text for the AI prompt
 */
async function fetchMenuFromSheet() {
  const menuSheetId = process.env.GOOGLE_SHEETS_MENU_ID;
  const menuSheetName = process.env.GOOGLE_SHEETS_MENU_SHEET || 'Menu';

  if (!sheetsClient || !menuSheetId) {
    console.log('⚠️  Menu sheet not configured (GOOGLE_SHEETS_MENU_ID missing)');
    return null;
  }

  try {
    console.log(`📋 Fetching menu from sheet ${menuSheetId} tab "${menuSheetName}"...`);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: menuSheetId,
      range: `${menuSheetName}!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.warn('⚠️  Menu sheet is empty or has only headers');
      return null;
    }

    // First row is headers, rest is data
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const catIdx = headers.findIndex(h => h.includes('category'));
    const nameIdx = headers.findIndex(h => h.includes('item') || h.includes('name'));
    const descIdx = headers.findIndex(h => h.includes('desc'));
    const priceIdx = headers.findIndex(h => h.includes('price'));

    if (nameIdx === -1 || priceIdx === -1) {
      console.error('❌ Menu sheet must have "Item Name" and "Price" columns. Found headers:', headers);
      return null;
    }

    // Parse rows into menu items grouped by category
    const menuByCategory = {};
    const menuItems = []; // flat list for OrderManager

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = row[nameIdx]?.trim();
      const price = parseFloat(row[priceIdx]?.replace(/[$,]/g, ''));
      const category = catIdx >= 0 ? (row[catIdx]?.trim() || 'Other') : 'Other';
      const description = descIdx >= 0 ? (row[descIdx]?.trim() || '') : '';

      if (!name || isNaN(price)) continue;

      if (!menuByCategory[category]) {
        menuByCategory[category] = [];
      }
      menuByCategory[category].push({ name, price, description });
      menuItems.push({ name, price, category, description });
    }

    // Format as text for the AI prompt
    const lines = [];
    for (const [category, items] of Object.entries(menuByCategory)) {
      lines.push(`\n${category.toUpperCase()}:`);
      for (const item of items) {
        const desc = item.description ? ` — ${item.description}` : '';
        lines.push(`  - ${item.name}: $${item.price.toFixed(2)}${desc}`);
      }
    }

    const menuText = lines.join('\n');
    console.log(`✅ Loaded ${menuItems.length} menu items from Google Sheets across ${Object.keys(menuByCategory).length} categories`);

    return { menuText, menuItems, menuByCategory };
  } catch (error) {
    console.error('❌ Failed to fetch menu from Google Sheets:', error.message);
    return null;
  }
}

/**
 * Format phone number as (123) 456-0987
 */
function formatPhoneNumber(phone) {
  if (!phone) return 'Unknown';
  const phoneStr = String(phone).toLowerCase().trim();
  if (['anonymous', 'blocked', 'restricted', 'private', 'undefined', 'null'].some(s => phoneStr.includes(s))) {
    return 'Blocked';
  }
  const digits = String(phone).replace(/\D/g, '');
  const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (clean.length !== 10) return phone || 'Unknown';
  return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
}

/**
 * Log a completed order to the Call Log Google Sheet
 * Columns: Name | Phone Number | Pick Up/Delivery | Delivery Address | Estimated Pick Up Time (EST) | Price | Order Details
 */
async function logOrderToCallLog(order) {
  const callLogSheetId = process.env.GOOGLE_SHEETS_ID;

  if (!sheetsClient || !callLogSheetId) {
    console.log('⚠️  Call Log sheet not configured — skipping order log');
    return false;
  }

  try {
    console.log('📝 Logging order to Call Log sheet...');
    console.log('   Customer:', order.customerName || 'Not provided');
    console.log('   Phone:', order.customerPhone || order.from || 'Unknown');
    console.log('   Items:', order.items?.length || 0, 'items');

    if (!order.items || order.items.length === 0) {
      console.error('❌ Order has no items — skipping log');
      return false;
    }

    // Calculate totals
    let subtotal = 0;
    order.items.forEach(item => {
      subtotal += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
    });
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Format items string
    const capitalize = (s) => s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : s;

    const itemsString = order.items.map(item => {
      const qty = item.quantity || 1;
      const name = item.name || 'Unknown';
      const size = item.size && item.size !== 'single' && item.size !== 'regular' ? `${item.size} ` : '';
      return `${qty}x ${size}${name}`;
    }).join('; ');

    // Delivery info
    const deliveryRaw = (order.deliveryMethod || '').toLowerCase();
    const isDelivery = deliveryRaw.includes('deliver');
    const deliveryMethod = isDelivery ? 'Delivery' : 'Pickup';
    const address = isDelivery
      ? (order.address?.trim() || 'Address not provided')
      : 'N/A';

    // Estimated pickup time
    let estMinutes = 10;
    if (order.items.length > 3) estMinutes += (order.items.length - 3) * 2;
    if (isDelivery) estMinutes += 10;
    estMinutes = Math.max(10, Math.ceil(estMinutes / 5) * 5);

    const estTime = new Date(Date.now() + estMinutes * 60000);
    const estTimeStr = estTime.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    // Build the row
    const row = [
      capitalize(order.customerName) || 'Not Provided',
      formatPhoneNumber(order.customerPhone || order.from),
      deliveryMethod,
      isDelivery ? capitalize(address) : 'N/A',
      estTimeStr,
      `$${total.toFixed(2)}`,
      capitalize(itemsString) || 'No Items'
    ];

    console.log('📝 Writing row:', row);

    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: callLogSheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] },
    });

    console.log('✅ Order logged to Call Log sheet —', response.data.updates?.updatedCells, 'cells');
    return true;
  } catch (error) {
    console.error('❌ Failed to log order to Call Log sheet:', error.message);
    return false;
  }
}

/**
 * Check if Google Sheets is initialized
 */
function isSheetsReady() {
  return !!sheetsClient;
}

module.exports = {
  initializeGoogleSheets,
  fetchMenuFromSheet,
  logOrderToCallLog,
  formatPhoneNumber,
  isSheetsReady,
};
