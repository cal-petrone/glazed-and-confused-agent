/**
 * Menu Configuration
 * Centralized menu data structure for Glazed and Confused donut shop
 */

const menu = {
  // ── DONUTS ─────────────────────────────────────────────
  'glazed donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.49, 'half-dozen': 12.99, dozen: 22.99 }
  },
  'chocolate frosted donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.99, 'half-dozen': 15.99, dozen: 27.99 }
  },
  'boston cream donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 3.49, 'half-dozen': 18.99, dozen: 33.99 }
  },
  'maple bar': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 }
  },
  'jelly filled donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 }
  },
  'sprinkle donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 }
  },
  'old fashioned donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 }
  },
  'apple fritter': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 3.99, 'half-dozen': 21.99, dozen: 39.99 }
  },
  'cruller': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.99, 'half-dozen': 15.99, dozen: 27.99 }
  },
  'cinnamon sugar donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 2.79, 'half-dozen': 14.99, dozen: 25.99 }
  },
  'blueberry cake donut': {
    sizes: ['single', 'half-dozen', 'dozen'],
    priceMap: { single: 3.29, 'half-dozen': 17.99, dozen: 31.99 }
  },

  // ── DONUT HOLES ────────────────────────────────────────
  'donut holes': {
    sizes: ['small', 'large'],
    priceMap: { small: 4.99, large: 8.99 }
  },

  // ── BAKERY ─────────────────────────────────────────────
  'muffin': {
    sizes: ['regular'],
    priceMap: { regular: 3.49 }
  },
  'croissant': {
    sizes: ['regular'],
    priceMap: { regular: 3.99 }
  },
  'bagel': {
    sizes: ['regular'],
    priceMap: { regular: 2.99 }
  },
  'bagel with cream cheese': {
    sizes: ['regular'],
    priceMap: { regular: 4.49 }
  },

  // ── COFFEE ─────────────────────────────────────────────
  'coffee': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 2.49, medium: 3.29, large: 3.99 }
  },
  'iced coffee': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 3.29, medium: 3.99, large: 4.79 }
  },
  'espresso': {
    sizes: ['single', 'double'],
    priceMap: { single: 2.99, double: 3.99 }
  },
  'latte': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 4.29, medium: 4.99, large: 5.79 }
  },
  'cappuccino': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 4.29, medium: 4.99, large: 5.79 }
  },

  // ── SPECIALTY DRINKS ───────────────────────────────────
  'hot chocolate': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 3.49, medium: 4.29, large: 4.99 }
  },
  'chai latte': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 4.49, medium: 5.29, large: 5.99 }
  },
  'matcha latte': {
    sizes: ['small', 'medium', 'large'],
    priceMap: { small: 4.99, medium: 5.79, large: 6.49 }
  },

  // ── OTHER DRINKS ───────────────────────────────────────
  'orange juice': {
    sizes: ['regular'],
    priceMap: { regular: 3.49 }
  },
  'milk': {
    sizes: ['regular'],
    priceMap: { regular: 2.49 }
  },
  'water': {
    sizes: ['regular'],
    priceMap: { regular: 1.99 }
  }
};

/**
 * Get menu as structured object
 */
function getMenu() {
  return menu;
}

/**
 * Get menu as formatted text for AI prompts
 */
function getMenuText() {
  const lines = [];

  lines.push('DONUTS (available single, half-dozen, or dozen):');
  [
    'glazed donut', 'chocolate frosted donut', 'boston cream donut',
    'maple bar', 'jelly filled donut', 'sprinkle donut',
    'old fashioned donut', 'apple fritter', 'cruller',
    'cinnamon sugar donut', 'blueberry cake donut'
  ].forEach(name => {
    const item = menu[name];
    const prices = item.sizes.map(s => `${s} $${item.priceMap[s].toFixed(2)}`).join(', ');
    lines.push(`- ${name} — ${prices}`);
  });

  lines.push('\nDONUT HOLES:');
  const holes = menu['donut holes'];
  lines.push(`- donut holes — small (25pc) $${holes.priceMap.small.toFixed(2)}, large (50pc) $${holes.priceMap.large.toFixed(2)}`);

  lines.push('\nBAKERY:');
  ['muffin', 'croissant', 'bagel', 'bagel with cream cheese'].forEach(name => {
    const item = menu[name];
    lines.push(`- ${name} — $${item.priceMap[Object.keys(item.priceMap)[0]].toFixed(2)}`);
  });

  lines.push('\nCOFFEE:');
  ['coffee', 'iced coffee', 'espresso', 'latte', 'cappuccino'].forEach(name => {
    const item = menu[name];
    const prices = item.sizes.map(s => `${s} $${item.priceMap[s].toFixed(2)}`).join(', ');
    lines.push(`- ${name} — ${prices}`);
  });

  lines.push('\nSPECIALTY DRINKS:');
  ['hot chocolate', 'chai latte', 'matcha latte'].forEach(name => {
    const item = menu[name];
    const prices = item.sizes.map(s => `${s} $${item.priceMap[s].toFixed(2)}`).join(', ');
    lines.push(`- ${name} — ${prices}`);
  });

  lines.push('\nOTHER DRINKS:');
  ['orange juice', 'milk', 'water'].forEach(name => {
    const item = menu[name];
    lines.push(`- ${name} — $${item.priceMap[Object.keys(item.priceMap)[0]].toFixed(2)}`);
  });

  return lines.join('\n');
}

/**
 * Find menu item by name (case-insensitive, fuzzy matching)
 */
function findMenuItem(itemName) {
  if (!itemName) return null;

  const lowerName = itemName.toLowerCase().trim();

  // Exact match
  if (menu[lowerName]) {
    return { name: lowerName, data: menu[lowerName] };
  }

  // Case-insensitive match
  for (const menuItem in menu) {
    if (menuItem.toLowerCase() === lowerName) {
      return { name: menuItem, data: menu[menuItem] };
    }
  }

  // Fuzzy match - check if all words in item name are in menu item
  const words = lowerName.split(/\s+/);
  for (const menuItem in menu) {
    const menuWords = menuItem.toLowerCase().split(/\s+/);
    if (words.every(word => menuWords.some(mw => mw.includes(word) || word.includes(mw)))) {
      return { name: menuItem, data: menu[menuItem] };
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

  const priceMap = found.data.priceMap;
  if (priceMap[size]) {
    return priceMap[size];
  }

  // If size not found, return first available price
  const sizes = Object.keys(priceMap);
  if (sizes.length > 0) {
    return priceMap[sizes[0]];
  }

  return null;
}

module.exports = {
  getMenu,
  getMenuText,
  findMenuItem,
  getPrice
};
