/**
 * Menu Configuration Tests
 * Glazed and Confused donut shop
 */

const { findMenuItem, getPrice, getMenu } = require('../src/config/menu');

describe('Menu Configuration', () => {
  test('should find menu item by exact name', () => {
    const result = findMenuItem('glazed donut');
    expect(result).not.toBeNull();
    expect(result.name).toBe('glazed donut');
  });
  
  test('should find menu item case-insensitively', () => {
    const result = findMenuItem('GLAZED DONUT');
    expect(result).not.toBeNull();
    expect(result.name).toBe('glazed donut');
  });
  
  test('should find menu item with fuzzy matching', () => {
    const result = findMenuItem('chocolate frosted');
    expect(result).not.toBeNull();
    expect(result.name).toBe('chocolate frosted donut');
  });
  
  test('should return null for non-existent item', () => {
    const result = findMenuItem('pizza that does not exist');
    expect(result).toBeNull();
  });
  
  test('should get price for donut item and size', () => {
    const price = getPrice('glazed donut', 'dozen');
    expect(price).toBe(22.99);
  });
  
  test('should get single price as default for donuts', () => {
    const price = getPrice('glazed donut', 'single');
    expect(price).toBe(2.49);
  });
  
  test('should get price for coffee with size', () => {
    const price = getPrice('latte', 'large');
    expect(price).toBe(5.79);
  });
  
  test('should get default price if size not specified', () => {
    const price = getPrice('muffin');
    expect(price).toBe(3.49);
  });
  
  test('should return null for invalid item', () => {
    const price = getPrice('invalid item');
    expect(price).toBeNull();
  });
  
  test('should return menu object with donut items', () => {
    const menu = getMenu();
    expect(menu).toHaveProperty('glazed donut');
    expect(menu).toHaveProperty('chocolate frosted donut');
    expect(menu).toHaveProperty('boston cream donut');
    expect(menu).toHaveProperty('coffee');
    expect(menu).toHaveProperty('latte');
    expect(menu).toHaveProperty('donut holes');
  });
  
  test('should find donut holes', () => {
    const result = findMenuItem('donut holes');
    expect(result).not.toBeNull();
    expect(result.data.sizes).toContain('small');
    expect(result.data.sizes).toContain('large');
  });
  
  test('should find coffee drinks', () => {
    const result = findMenuItem('iced coffee');
    expect(result).not.toBeNull();
    expect(result.data.sizes).toContain('small');
    expect(result.data.sizes).toContain('medium');
    expect(result.data.sizes).toContain('large');
  });
  
  test('should get half-dozen pricing', () => {
    const price = getPrice('sprinkle donut', 'half-dozen');
    expect(price).toBe(14.99);
  });
});
