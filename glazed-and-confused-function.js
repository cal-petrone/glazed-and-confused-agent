/**
 * Glazed and Confused Donut Shop AI Receptionist — Twilio Function with OpenAI Integration
 * 
 * EXPECTED JSON INPUT from Twilio Studio (POST):
 * {
 *   "speech": "string - caller's speech from Gather widget",
 *   "from": "string - caller phone number",
 *   "callSid": "string - unique call identifier",
 *   "order": object | JSON string | null - existing order state
 * }
 * 
 * JSON OUTPUT to Twilio Studio:
 * {
 *   "say": "string - text for Studio to speak to caller",
 *   "order": object - updated order state (for Studio Set Variables),
 *   "shouldLog": boolean - true when order is confirmed and ready for Zapier
 * }
 * 
 * Studio Usage:
 * - Set Variables: order = {{widgets.http_1.parsed.order}} (Parse as JSON Object)
 * - Say: {{widgets.http_1.parsed.say}}
 * - Split based on shouldLog to trigger Zapier webhook
 * 
 * ENVIRONMENT VARIABLE REQUIRED:
 * - OPENAI_API_KEY: Your OpenAI API key (set in Twilio Function configuration)
 */

const https = require('https');

exports.handler = function(context, event, callback) {
  try {
    return processOrder(context, event, callback);
  } catch (error) {
    console.error('Unexpected error:', error);
    const safeResponse = {
      say: "I'm sorry, I ran into an issue. Please call back and we'll get your order taken care of.",
      order: { items: [], confirmed: false },
      shouldLog: false
    };
    return callback(null, safeResponse);
  }
};

function processOrder(context, event, callback) {
  // Extract speech from various possible field names
  let speech = '';
  
  if (event.speech) {
    speech = event.speech;
  } else if (event.SpeechResult) {
    speech = event.SpeechResult;
  } else if (event.widgets && event.widgets.gather_1 && event.widgets.gather_1.SpeechResult) {
    speech = event.widgets.gather_1.SpeechResult;
  } else {
    for (const key in event) {
      if (key.toLowerCase().includes('speech') || key.toLowerCase().includes('result')) {
        const value = event[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          speech = value;
          break;
        }
      }
    }
  }
  
  speech = speech.toString().trim();
  const from = (event.from || '').toString();
  const callSid = (event.callSid || '').toString();
  
  console.log('Received speech:', speech);
  
  // Parse order state
  let order = parseOrderState(event.order);
  
  // Initialize order structure
  if (!order.items || !Array.isArray(order.items)) {
    order.items = [];
  }
  if (typeof order.confirmed !== 'boolean') {
    order.confirmed = false;
  }
  if (!order.pendingQuestion) {
    order.pendingQuestion = null;
  }
  
  // Menu configuration — Glazed and Confused donut shop
  const menu = {
    // Donuts
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
    // Donut holes
    'donut holes': {
      sizes: ['small', 'large'],
      priceMap: { small: 4.99, large: 8.99 }
    },
    // Bakery
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
    // Coffee
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
    // Specialty drinks
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
    // Other drinks
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
  
  // Handle empty speech
  if (!speech || speech.length === 0) {
    const fallbackResponse = {
      say: order.items.length === 0 
        ? "I didn't catch that. What would you like to order?" 
        : "I didn't hear that. Could you repeat?",
      order: order,
      shouldLog: false
    };
    return callback(null, fallbackResponse);
  }
  
  // Get OpenAI API key from environment
  const openaiApiKey = context.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return callback(null, {
      say: "I'm having trouble connecting right now. Please try again in a moment.",
      order: order,
      shouldLog: false
    });
  }
  
  // Call OpenAI to understand the speech and generate response
  callOpenAI(openaiApiKey, speech, order, menu)
    .then(aiResult => {
      const updatedOrder = updateOrderFromAI(order, aiResult, menu);
      
      let shouldLog = aiResult.shouldLog || false;
      if (updatedOrder.confirmed && updatedOrder.items.length > 0) {
        const hasDeliveryMethod = !!updatedOrder.deliveryMethod;
        const hasAddress = updatedOrder.deliveryMethod !== 'delivery' || !!updatedOrder.address;
        const hasPayment = !!updatedOrder.paymentMethod;
        
        if (hasDeliveryMethod && hasAddress && hasPayment) {
          shouldLog = true;
        }
      }
      
      return callback(null, {
        say: aiResult.response || "Got it! Anything else?",
        order: updatedOrder,
        shouldLog: shouldLog
      });
    })
    .catch(error => {
      console.error('OpenAI API error:', error);
      return callback(null, getFallbackResponse(speech, order, menu));
    });
}

/**
 * Call OpenAI API to understand speech and generate conversational response
 */
function callOpenAI(apiKey, speech, order, menu) {
  return new Promise((resolve, reject) => {
    const systemPrompt = buildSystemPrompt(menu, order);
    const userMessage = `Customer said: "${speech}"`;
    
    const requestData = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 300
    });
    
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI API returned status ${res.statusCode}: ${response.error?.message || 'Unknown error'}`));
            return;
          }
          
          const content = response.choices[0].message.content.trim();
          console.log('OpenAI raw response:', content);
          
          let aiResult;
          try {
            let jsonMatch = content.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch && content.includes('```')) {
              const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
              if (codeBlockMatch) {
                jsonMatch = codeBlockMatch;
              }
            }
            
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              aiResult = JSON.parse(jsonStr);
              
              if (!aiResult.response) {
                aiResult.response = content;
              }
              if (!aiResult.extractedData) {
                aiResult.extractedData = {};
              }
              if (typeof aiResult.shouldLog !== 'boolean') {
                aiResult.shouldLog = false;
              }
            } else {
              aiResult = {
                response: content,
                extractedData: {},
                shouldLog: false
              };
            }
          } catch (parseError) {
            aiResult = {
              response: content,
              extractedData: extractIntentFromText(content, order),
              shouldLog: false
            };
          }
          
          resolve(aiResult);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(requestData);
    req.end();
  });
}

/**
 * Build system prompt for OpenAI with menu, order state, and instructions
 */
function buildSystemPrompt(menu, order) {
  const menuList = Object.keys(menu).map(itemName => {
    const item = menu[itemName];
    const sizes = item.sizes.join(', ');
    return `- ${itemName} (sizes: ${sizes})`;
  }).join('\n');
  
  let orderSummary = 'No items in order yet.';
  if (order.items && order.items.length > 0) {
    orderSummary = order.items.map(item => {
      const qty = item.quantity || 1;
      const size = item.size || '';
      return `${qty}x ${size} ${item.name}`;
    }).join(', ');
  }
  
  const deliveryMethod = order.deliveryMethod || 'not specified';
  const address = order.address || 'not provided';
  const paymentMethod = order.paymentMethod || 'not specified';
  
  return `You are a warm, friendly ordering assistant for Glazed and Confused, a beloved neighborhood donut shop. You help customers place orders over the phone.

AVAILABLE MENU ITEMS:
${menuList}

CURRENT ORDER STATE:
Items: ${orderSummary}
Delivery Method: ${deliveryMethod}
Address: ${address}
Payment Method: ${paymentMethod}
Pending Question: ${order.pendingQuestion || 'none'}

INSTRUCTIONS:
1. Understand what the customer is saying naturally — they might say "glazed" (meaning glazed donut), "a dozen chocolate" (meaning dozen chocolate frosted donuts), "large coffee", etc.
2. Extract ANY items mentioned — if customer says multiple items in one sentence, extract ALL of them
3. Match items to the menu — use EXACT menu item names from the list above
4. Generate a friendly, conversational response (like a real donut shop employee)
5. If they add item(s), confirm them naturally like "Got it! A dozen glazed donuts and a large coffee. What else can I get you?"
6. Donut sizes are: single, half-dozen, dozen. Drink sizes are: small, medium, large. Default donuts to "single" if not specified.
7. Common completion phrases: "I'm all set", "that's it", "that's all", "that'll be it", "I'm done", "nothing else"
8. When they indicate they're done, ask about pickup/delivery if not already known
9. Don't ask pickup/delivery immediately after adding items — only when they say they're done
10. Use 8% sales tax for calculations
11. When order is complete and customer confirms, set "shouldLog": true
12. If customer says "a dozen donuts" without specifying type, ask which kind
13. Always return valid JSON

IMPORTANT - Return ONLY valid JSON in this exact format:
{
  "response": "Your conversational response to speak to the customer",
  "extractedData": {
    "items": [{"name": "glazed donut", "size": "dozen", "quantity": 1}],
    "deliveryMethod": "pickup" or "delivery" or null,
    "address": "address string" or null,
    "paymentMethod": "cash" or "card" or null,
    "isDone": true or false,
    "isConfirmed": true or false
  },
  "shouldLog": true or false,
  "pendingQuestion": "deliveryMethod" or "address" or "paymentMethod" or null
}

Be conversational and helpful, not robotic!`;
}

/**
 * Extract intent from text response when JSON parsing fails
 */
function extractIntentFromText(text, currentOrder) {
  const textLower = text.toLowerCase();
  const extracted = {
    items: [],
    isDone: false,
    isConfirmed: false
  };
  
  if (textLower.includes("i'm all set") || textLower.includes("that's it") || 
      textLower.includes("that's all") || textLower.includes("that'll be it") ||
      textLower.includes("i'm done") || textLower.includes("nothing else")) {
    extracted.isDone = true;
  }
  
  if (textLower.includes("yes") || textLower.includes("correct") || textLower.includes("right")) {
    extracted.isConfirmed = true;
  }
  
  return extracted;
}

/**
 * Update order state based on AI's extracted data
 */
function updateOrderFromAI(currentOrder, aiResult, menu) {
  const order = JSON.parse(JSON.stringify(currentOrder));
  const extracted = aiResult.extractedData || {};
  
  if (extracted.items && Array.isArray(extracted.items) && extracted.items.length > 0) {
    extracted.items.forEach(newItem => {
      let menuItemName = newItem.name;
      
      if (!menu[menuItemName]) {
        const lowerName = menuItemName.toLowerCase();
        for (const menuItem in menu) {
          if (menuItem.toLowerCase() === lowerName) {
            menuItemName = menuItem;
            break;
          }
        }
      }
      
      if (!menu[menuItemName]) {
        const words = menuItemName.toLowerCase().split(/\s+/);
        for (const menuItem in menu) {
          const menuWords = menuItem.toLowerCase().split(/\s+/);
          if (words.every(word => menuWords.some(mw => mw.includes(word) || word.includes(mw)))) {
            menuItemName = menuItem;
            break;
          }
        }
      }
      
      if (menu[menuItemName]) {
        let size = newItem.size;
        if (!size && menu[menuItemName].sizes.length > 0) {
          size = menu[menuItemName].sizes[0];
        }
        
        const quantity = newItem.quantity || 1;
        const price = menu[menuItemName].priceMap[size] || 0;
        
        order.items.push({
          name: menuItemName,
          size: size,
          quantity: quantity,
          price: price
        });
        
        console.log(`Added item: ${quantity}x ${size} ${menuItemName}`);
      } else {
        console.warn(`Item not found in menu: "${newItem.name}"`);
      }
    });
  }
  
  if (extracted.deliveryMethod) {
    order.deliveryMethod = extracted.deliveryMethod;
  }
  if (extracted.address) {
    order.address = extracted.address;
  }
  if (extracted.paymentMethod) {
    order.paymentMethod = extracted.paymentMethod;
  }
  if (aiResult.pendingQuestion !== undefined) {
    order.pendingQuestion = aiResult.pendingQuestion;
  }
  if (extracted.isConfirmed) {
    order.confirmed = true;
  } else if (extracted.isDone && !extracted.isConfirmed) {
    order.confirmed = false;
  }
  
  return order;
}

/**
 * Fallback response if OpenAI fails
 */
function getFallbackResponse(speech, order, menu) {
  const speechLower = speech.toLowerCase();
  
  const completionPhrases = [
    'done', "that's all", 'finished', "i'm all set", "that's it", 
    "that'll be it", "i'm done", "nothing else", "that's everything"
  ];
  
  const isCompletionPhrase = completionPhrases.some(phrase => speechLower.includes(phrase));
  
  if (isCompletionPhrase) {
    if (order.items.length === 0) {
      return {
        say: "You haven't added any items yet. What would you like to order?",
        order: order,
        shouldLog: false
      };
    }
    
    const nextQuestion = getNextRequiredQuestion(order);
    if (nextQuestion) {
      order.pendingQuestion = nextQuestion.includes('pickup') ? 'deliveryMethod' : 
                             nextQuestion.includes('address') ? 'address' : 
                             nextQuestion.includes('cash') ? 'paymentMethod' : null;
      return {
        say: nextQuestion,
        order: order,
        shouldLog: false
      };
    }
    
    const totals = calculateTotals(order, menu);
    const summary = generateOrderSummary(order, menu, totals);
    order.confirmed = true;
    return {
      say: summary + " Is that correct?",
      order: order,
      shouldLog: false
    };
  }
  
  return {
    say: "I'm having trouble understanding right now. Could you try saying that again?",
    order: order,
    shouldLog: false
  };
}

/**
 * Parse order state from various formats
 */
function parseOrderState(orderInput) {
  if (orderInput === undefined || orderInput === null || orderInput === 'undefined' || orderInput === 'null') {
    return { items: [], confirmed: false, pendingQuestion: null };
  }
  
  if (typeof orderInput === 'string') {
    const trimmed = orderInput.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
      return { items: [], confirmed: false, pendingQuestion: null };
    }
    
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return { items: [], confirmed: false, pendingQuestion: null };
    } catch (e) {
      return { items: [], confirmed: false, pendingQuestion: null };
    }
  }
  
  if (typeof orderInput === 'object') {
    try {
      return JSON.parse(JSON.stringify(orderInput));
    } catch (e) {
      return { items: [], confirmed: false, pendingQuestion: null };
    }
  }
  
  return { items: [], confirmed: false, pendingQuestion: null };
}

/**
 * Get the next required question based on current order state
 */
function getNextRequiredQuestion(order) {
  if (!order.deliveryMethod) {
    return "Is this for pickup or delivery?";
  }
  
  if (order.deliveryMethod === 'delivery' && !order.address) {
    return "What's your delivery address?";
  }
  
  if (!order.paymentMethod) {
    return "Will you be paying with cash or card?";
  }
  
  return null;
}

/**
 * Calculate order totals with 8% sales tax
 */
function calculateTotals(order, menu) {
  let subtotal = 0;
  
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      if (menu[item.name] && menu[item.name].priceMap[item.size]) {
        item.price = menu[item.name].priceMap[item.size];
      }
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      subtotal += itemTotal;
    });
  }
  
  const taxRate = 0.08;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

/**
 * Generate order summary for confirmation
 */
function generateOrderSummary(order, menu, totals) {
  let summary = "Here's your order. ";
  
  if (order.items && order.items.length > 0) {
    summary += "You have ";
    order.items.forEach((item, index) => {
      const qty = item.quantity || 1;
      const size = item.size || '';
      const itemDesc = qty > 1 ? `${qty} ${size} ${item.name}s` : `1 ${size} ${item.name}`;
      
      if (index === 0) {
        summary += itemDesc;
      } else if (index === order.items.length - 1) {
        summary += ` and ${itemDesc}`;
      } else {
        summary += `, ${itemDesc}`;
      }
    });
    summary += ". ";
  }
  
  summary += `Subtotal is $${totals.subtotal.toFixed(2)}, `;
  summary += `tax is $${totals.tax.toFixed(2)}, `;
  summary += `for a total of $${totals.total.toFixed(2)}. `;
  
  if (order.deliveryMethod === 'pickup') {
    summary += "This is for pickup. ";
  } else if (order.deliveryMethod === 'delivery') {
    summary += `This is for delivery to ${order.address || 'your address'}. `;
  }
  
  if (order.paymentMethod) {
    summary += `Payment will be by ${order.paymentMethod}. `;
  }
  
  return summary;
}
