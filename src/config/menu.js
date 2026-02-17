/**
 * Menu Configuration
 * Supports both a hardcoded fallback menu and dynamic menu loaded from Google Sheets.
 * The dynamic menu (from Sheets) takes priority if loaded successfully.
 */

// ── Dynamic menu (populated from Google Sheets at startup) ──
let dynamicMenuText = null;   // formatted text for AI prompt
let dynamicMenuItems = null;  // flat array of { name, price, category }

/**
 * Set the dynamic menu loaded from Google Sheets
 * Called once at startup from server.js
 */
function setDynamicMenu(sheetData) {
  if (sheetData && sheetData.menuText && sheetData.menuItems) {
    dynamicMenuText = sheetData.menuText;
    dynamicMenuItems = sheetData.menuItems;
    console.log(`✅ Dynamic menu set: ${dynamicMenuItems.length} items`);
  }
}

// ── Hardcoded fallback menu ──
const fallbackMenu = {
  'glazed donut':           { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.49, 'half-dozen': 12.99, dozen: 22.99 } },
  'chocolate frosted donut':{ sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.99, 'half-dozen': 15.99, dozen: 27.99 } },
  'boston cream donut':      { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 3.49, 'half-dozen': 18.99, dozen: 33.99 } },
  'maple bar':              { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 } },
  'jelly filled donut':     { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 } },
  'sprinkle donut':         { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 } },
  'old fashioned donut':    { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 } },
  'apple fritter':          { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 3.99, 'half-dozen': 21.99, dozen: 39.99 } },
  'cruller':                { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.99, 'half-dozen': 15.99, dozen: 27.99 } },
  'cinnamon sugar donut':   { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 } },
  'blueberry cake donut':   { sizes: ['single', 'half-dozen', 'dozen'], priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 } },
  'donut holes':            { sizes: ['small', 'large'], priceMap: { small: 4.99, large: 8.99 } },
  'muffin':                 { sizes: ['regular'], priceMap: { regular: 3.49 } },
  'croissant':              { sizes: ['regular'], priceMap: { regular: 3.99 } },
  'bagel':                  { sizes: ['regular'], priceMap: { regular: 2.99 } },
  'bagel with cream cheese':{ sizes: ['regular'], priceMap: { regular: 4.49 } },
  'coffee':                 { sizes: ['small', 'medium', 'large'], priceMap: { small: 2.49, medium: 3.29, large: 3.99 } },
  'iced coffee':            { sizes: ['small', 'medium', 'large'], priceMap: { small: 3.29, medium: 3.99, large: 4.79 } },
  'espresso':               { sizes: ['single', 'double'], priceMap: { single: 2.99, double: 3.99 } },
  'latte':                  { sizes: ['small', 'medium', 'large'], priceMap: { small: 4.29, medium: 4.99, large: 5.79 } },
  'cappuccino':             { sizes: ['small', 'medium', 'large'], priceMap: { small: 4.29, medium: 4.99, large: 5.79 } },
  'hot chocolate':          { sizes: ['small', 'medium', 'large'], priceMap: { small: 3.49, medium: 4.29, large: 4.99 } },
  'chai latte':             { sizes: ['small', 'medium', 'large'], priceMap: { small: 4.49, medium: 5.29, large: 5.99 } },
  'matcha latte':           { sizes: ['small', 'medium', 'large'], priceMap: { small: 4.99, medium: 5.79, large: 6.49 } },
  'orange juice':           { sizes: ['regular'], priceMap: { regular: 3.49 } },
  'milk':                   { sizes: ['regular'], priceMap: { regular: 2.49 } },
  'water':                  { sizes: ['regular'], priceMap: { regular: 1.99 } },
};

/**
 * Get menu as formatted text for AI prompts.
 * Prefers dynamic (Google Sheets) menu if available.
 */
function getMenuText() {
  if (dynamicMenuText) {
    return dynamicMenuText;
  }
  return _buildFallbackMenuText();
}

function _buildFallbackMenuText() {
  const lines = [];
  const donutNames = ['glazed donut','chocolate frosted donut','boston cream donut','maple bar',
    'jelly filled donut','sprinkle donut','old fashioned donut','apple fritter','cruller',
    'cinnamon sugar donut','blueberry cake donut'];

  lines.push('DONUTS (single, half-dozen, or dozen):');
  donutNames.forEach(n => {
    const it = fallbackMenu[n];
    lines.push(`  - ${n}: ${it.sizes.map(s => `${s} $${it.priceMap[s].toFixed(2)}`).join(', ')}`);
  });

  lines.push('\nDONUT HOLES:');
  const h = fallbackMenu['donut holes'];
  lines.push(`  - donut holes: small (25pc) $${h.priceMap.small.toFixed(2)}, large (50pc) $${h.priceMap.large.toFixed(2)}`);

  lines.push('\nBAKERY:');
  ['muffin','croissant','bagel','bagel with cream cheese'].forEach(n => {
    lines.push(`  - ${n}: $${fallbackMenu[n].priceMap[Object.keys(fallbackMenu[n].priceMap)[0]].toFixed(2)}`);
  });

  lines.push('\nCOFFEE:');
  ['coffee','iced coffee','espresso','latte','cappuccino'].forEach(n => {
    const it = fallbackMenu[n];
    lines.push(`  - ${n}: ${it.sizes.map(s => `${s} $${it.priceMap[s].toFixed(2)}`).join(', ')}`);
  });

  lines.push('\nSPECIALTY DRINKS:');
  ['hot chocolate','chai latte','matcha latte'].forEach(n => {
    const it = fallbackMenu[n];
    lines.push(`  - ${n}: ${it.sizes.map(s => `${s} $${it.priceMap[s].toFixed(2)}`).join(', ')}`);
  });

  lines.push('\nOTHER:');
  ['orange juice','milk','water'].forEach(n => {
    lines.push(`  - ${n}: $${fallbackMenu[n].priceMap[Object.keys(fallbackMenu[n].priceMap)[0]].toFixed(2)}`);
  });

  return lines.join('\n');
}

/**
 * Find menu item by name (case-insensitive, fuzzy matching).
 * Checks dynamic menu first, then falls back to hardcoded.
 */
function findMenuItem(itemName) {
  if (!itemName) return null;
  const lowerName = itemName.toLowerCase().trim();

  // Try dynamic menu first
  if (dynamicMenuItems) {
    const exact = dynamicMenuItems.find(it => it.name.toLowerCase() === lowerName);
    if (exact) {
      return { name: exact.name, data: { sizes: ['regular'], priceMap: { regular: exact.price } } };
    }
    // Fuzzy: check if search words appear in item name
    const words = lowerName.split(/\s+/);
    const fuzzy = dynamicMenuItems.find(it => {
      const itemWords = it.name.toLowerCase().split(/\s+/);
      return words.every(w => itemWords.some(iw => iw.includes(w) || w.includes(iw)));
    });
    if (fuzzy) {
      return { name: fuzzy.name, data: { sizes: ['regular'], priceMap: { regular: fuzzy.price } } };
    }
  }

  // Fallback to hardcoded menu
  if (fallbackMenu[lowerName]) {
    return { name: lowerName, data: fallbackMenu[lowerName] };
  }
  for (const key in fallbackMenu) {
    if (key.toLowerCase() === lowerName) return { name: key, data: fallbackMenu[key] };
  }
  const words = lowerName.split(/\s+/);
  for (const key in fallbackMenu) {
    const menuWords = key.toLowerCase().split(/\s+/);
    if (words.every(w => menuWords.some(mw => mw.includes(w) || w.includes(mw)))) {
      return { name: key, data: fallbackMenu[key] };
    }
  }

  return null;
}

/**
 * Get price for a menu item
 */
function getPrice(itemName, size = 'single') {
  const found = findMenuItem(itemName);
  if (!found) return null;
  const pm = found.data.priceMap;
  if (pm[size]) return pm[size];
  // If requested size not found, return first available
  const firstKey = Object.keys(pm)[0];
  return firstKey ? pm[firstKey] : null;
}

function getMenu() {
  return fallbackMenu;
}

module.exports = {
  getMenu,
  getMenuText,
  findMenuItem,
  getPrice,
  setDynamicMenu,
};
