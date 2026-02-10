/**
 * Order Manager Tests
 * Tests for order state management and calculations
 * Glazed and Confused donut shop
 */

const OrderManager = require('../src/services/order-manager');

describe('OrderManager', () => {
  let orderManager;
  
  beforeEach(() => {
    orderManager = new OrderManager('test-stream-123', 'test-call-456', '+1234567890');
  });
  
  test('should create empty order', () => {
    const order = orderManager.getOrder();
    expect(order.items).toEqual([]);
    expect(order.confirmed).toBe(false);
    expect(order.logged).toBe(false);
    expect(order.streamSid).toBe('test-stream-123');
    expect(order.callSid).toBe('test-call-456');
  });
  
  test('should add donut item to order', () => {
    orderManager.addItem('glazed donut', 'dozen', 1);
    const order = orderManager.getOrder();
    
    expect(order.items.length).toBe(1);
    expect(order.items[0].name).toBe('glazed donut');
    expect(order.items[0].size).toBe('dozen');
    expect(order.items[0].quantity).toBe(1);
    expect(order.items[0].price).toBe(22.99);
  });
  
  test('should add coffee item to order', () => {
    orderManager.addItem('latte', 'large', 1);
    const order = orderManager.getOrder();
    
    expect(order.items.length).toBe(1);
    expect(order.items[0].name).toBe('latte');
    expect(order.items[0].size).toBe('large');
    expect(order.items[0].price).toBe(5.79);
  });
  
  test('should update quantity for duplicate items', () => {
    orderManager.addItem('glazed donut', 'single', 1);
    orderManager.addItem('glazed donut', 'single', 2);
    const order = orderManager.getOrder();
    
    expect(order.items.length).toBe(1);
    expect(order.items[0].quantity).toBe(3);
  });
  
  test('should calculate totals correctly', () => {
    orderManager.addItem('glazed donut', 'dozen', 1); // $22.99
    orderManager.addItem('coffee', 'medium', 2);       // $3.29 * 2 = $6.58
    
    const totals = orderManager.recalculateTotals(0.08); // 8% tax
    
    const subtotal = 22.99 + 6.58; // $29.57
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    expect(orderManager.getOrder().subtotal).toBeCloseTo(subtotal, 2);
    expect(orderManager.getOrder().tax).toBeCloseTo(tax, 2);
    expect(orderManager.getOrder().total).toBeCloseTo(total, 2);
  });
  
  test('should set delivery method', () => {
    orderManager.setDeliveryMethod('delivery');
    expect(orderManager.getOrder().deliveryMethod).toBe('delivery');
    
    orderManager.setDeliveryMethod('pickup');
    expect(orderManager.getOrder().deliveryMethod).toBe('pickup');
  });
  
  test('should reject invalid delivery method', () => {
    expect(() => {
      orderManager.setDeliveryMethod('invalid');
    }).toThrow();
  });
  
  test('should set address', () => {
    orderManager.setAddress('456 Maple Ave, Portland, OR 97201');
    expect(orderManager.getOrder().address).toBe('456 Maple Ave, Portland, OR 97201');
  });
  
  test('should set customer name', () => {
    orderManager.setCustomerName('Jane Smith');
    expect(orderManager.getOrder().customerName).toBe('Jane Smith');
  });
  
  test('should reject empty customer name', () => {
    expect(() => {
      orderManager.setCustomerName('');
    }).toThrow();
  });
  
  test('should confirm order', () => {
    orderManager.addItem('glazed donut', 'dozen', 1);
    orderManager.setCustomerName('Jane Smith');
    orderManager.confirm();
    
    expect(orderManager.getOrder().confirmed).toBe(true);
  });
  
  test('should reject confirming empty order', () => {
    expect(() => {
      orderManager.confirm();
    }).toThrow();
  });
  
  test('should reject confirming without customer name', () => {
    orderManager.addItem('glazed donut', 'dozen', 1);
    expect(() => {
      orderManager.confirm();
    }).toThrow();
  });
  
  test('should check if ready to log', () => {
    expect(orderManager.isReadyToLog()).toBe(false);
    
    orderManager.addItem('glazed donut', 'dozen', 1);
    expect(orderManager.isReadyToLog()).toBe(false);
    
    orderManager.setCustomerName('Jane Smith');
    expect(orderManager.isReadyToLog()).toBe(false);
    
    orderManager.confirm();
    expect(orderManager.isReadyToLog()).toBe(true);
    
    orderManager.markAsLogged();
    expect(orderManager.isReadyToLog()).toBe(false);
  });
  
  test('should generate order summary', () => {
    orderManager.addItem('glazed donut', 'dozen', 2);
    orderManager.addItem('latte', 'large', 1);
    
    const summary = orderManager.getSummary();
    expect(summary).toContain('glazed donut');
    expect(summary).toContain('latte');
  });
  
  test('should generate order for logging', () => {
    orderManager.addItem('glazed donut', 'dozen', 1);
    orderManager.setDeliveryMethod('delivery');
    orderManager.setAddress('456 Maple Ave');
    orderManager.setCustomerName('Jane Smith');
    orderManager.setPaymentMethod('card');
    orderManager.confirm();
    
    const logData = orderManager.getOrderForLogging();
    
    expect(logData.callSid).toBe('test-call-456');
    expect(logData.customerName).toBe('Jane Smith');
    expect(logData.deliveryMethod).toBe('delivery');
    expect(logData.status).toBe('completed');
    expect(logData.items.length).toBe(1);
  });
  
  test('should handle half-dozen size correctly', () => {
    orderManager.addItem('boston cream donut', 'half-dozen', 1);
    const order = orderManager.getOrder();
    
    expect(order.items[0].size).toBe('half-dozen');
    expect(order.items[0].price).toBe(18.99);
  });
});
