const { Groq } = require("groq-sdk");
const pool = require("../db/pool");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY",
});

async function chatWithGroq(messageHistory, businessId) {
  try {
    // 1. Fetch Business Settings
    const settingsRes = await pool.query(
      `SELECT restaurant_name, address, phone FROM business_settings WHERE business_id = $1 LIMIT 1`,
      [businessId]
    );
    const settings = settingsRes.rows[0] || {
      restaurant_name: "Classic Chinese",
      address: "Kuditre Factory, Koparde",
      phone: "91 9146803032"
    };

    const locationRes = await pool.query(
      `SELECT open_time,close_time,address,phone FROM location_content WHERE business_id = $1 LIMIT 1`,
      [businessId]
    );
    const location = locationRes.rows[0] || {
      open_time: "10:00",
      close_time: "23:00",
      address: "Kuditre Factory, Koparde",
      phone: "91 9146803032"
    };

    // 2. Fetch Active Menu Items
    const menuRes = await pool.query(
      `SELECT m.name, m.price, m.variants, m.description, m.diet_type, m.available, c.name as category_name
       FROM menu_items m
       JOIN menu_categories c ON m.category_id = c.id
       WHERE m.business_id = $1`,
      [businessId]
    );
    const menuItems = menuRes.rows;

    // 3. Fetch Best Seller (Top 2)
    const bestSellerRes = await pool.query(
      `SELECT m.name, m.available
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE m.business_id = $1
       GROUP BY m.name, m.available
       ORDER BY SUM(oi.quantity) DESC
       LIMIT 2`,
      [businessId]
    );
    
    let bestSellerInfo = "";
    if (bestSellerRes.rows.length > 0) {
      const topSeller = bestSellerRes.rows[0];
      if (topSeller.available) {
        bestSellerInfo = `\n- Best Seller: ${topSeller.name} (Enthusiastically recommend this!)`;
      } else if (bestSellerRes.rows.length > 1) {
        const secondSeller = bestSellerRes.rows[1];
        bestSellerInfo = `\n- Best Seller: ${topSeller.name} is our all-time best seller, but since it is [OUT OF STOCK] today, you MUST playfully mention it's sold out and enthusiastically recommend our second best seller: ${secondSeller.name}!`;
      }
    }

    // 3.5 Fetch Best Sellers Per Category
    const categoryBestSellersRes = await pool.query(
      `WITH RankedItems AS (
         SELECT c.name as category_name, m.name as item_name, m.available, SUM(oi.quantity) as total_sold,
                ROW_NUMBER() OVER(PARTITION BY c.id ORDER BY SUM(oi.quantity) DESC) as rank
         FROM order_items oi
         JOIN menu_items m ON oi.menu_item_id = m.id
         JOIN menu_categories c ON m.category_id = c.id
         WHERE m.business_id = $1
         GROUP BY c.id, c.name, m.name, m.available
       )
       SELECT category_name, item_name, available
       FROM RankedItems
       WHERE rank = 1`,
      [businessId]
    );

    if (categoryBestSellersRes.rows.length > 0) {
      bestSellerInfo += `\n- Category Best Sellers:\n`;
      categoryBestSellersRes.rows.forEach(row => {
        const note = row.available ? "" : " (Out of stock - playfully acknowledge this and suggest an alternative)";
        bestSellerInfo += `  * ${row.category_name}: ${row.item_name}${note}\n`;
      });
    }

    // 3.6 Fetch Public Coupons
    const publicCouponsRes = await pool.query(
      `SELECT code, discount_type, value 
       FROM coupons 
       WHERE business_id = $1 AND active = true AND is_public = true 
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE) 
         AND used_count < usage_limit`,
      [businessId]
    );

    let couponsInfo = "";
    if (publicCouponsRes.rows.length > 0) {
      couponsInfo = `\n- Public Promotions:\n`;
      publicCouponsRes.rows.forEach(c => {
        const valueText = c.discount_type === "percent" ? `${parseFloat(c.value)}% off` : `₹${parseFloat(c.value)} off`;
        couponsInfo += `  * Code: ${c.code} (${valueText})\n`;
      });
    }

    const categories = [...new Set(menuItems.map(m => m.category_name))];
    let categoryInstruction = "";
    if (categories.length > 6) {
       categoryInstruction = `\n12. CATEGORIES: We have ${categories.length} categories. If asked what categories we have, DO NOT list all of them. Only list the first 5 (${categories.slice(0, 5).join(", ")}) and then say something like "...and more! Let me know what you're in the mood for!"`;
    } else {
       categoryInstruction = `\n12. CATEGORIES: If asked what categories we have, list them: ${categories.join(", ")}.`;
    }

    const now = new Date();
    const istTime = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });

    // 4. Construct the System Prompt
    let systemPrompt = `You are the friendly, professional, and concise customer support AI for a restaurant named "${settings.restaurant_name}".
Your goal is to assist customers with questions about the menu, hours, and location.

CURRENT CONTEXT:
- Current Date & Time: ${istTime} (IST)

RESTAURANT INFO:
- Address: ${settings.address || location.address}
- Phone: ${settings.phone || location.phone}
- Hours: ${location.open_time} to ${location.close_time}

CURRENT MENU:
`;

    if (bestSellerInfo || couponsInfo) {
      systemPrompt = systemPrompt.replace("RESTAURANT INFO:", `RESTAURANT INFO:${bestSellerInfo}${couponsInfo}`);
    }

    menuItems.forEach(item => {
      let variantStr = "";
      let parsedVariants = item.variants;
      if (typeof parsedVariants === "string") {
        try { parsedVariants = JSON.parse(parsedVariants); } catch (e) { parsedVariants = []; }
      }
      if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
        variantStr = " Variants: " + parsedVariants.map(v => `${v.name} (₹${v.price})`).join(", ");
      }
      const availabilityTag = item.available ? "" : "[OUT OF STOCK]";
      systemPrompt += `- ${item.name} (${item.category_name}) ${availabilityTag}: Base Price ₹${item.price}.${variantStr} ${item.diet_type !== 'none' ? `[${item.diet_type}]` : ''} ${item.description}\n`;
    });

    systemPrompt += `
RULES:
1. ONLY recommend items that are on the CURRENT MENU provided above. If a customer asks for something not on the menu (like pizza or burgers), politely explain that you are a Chinese restaurant and suggest a popular alternative from the menu.
2. Be concise and conversational.
3. If asked about allergies, rely ONLY on the item descriptions. If unsure, advise the customer to ask the staff directly upon ordering.
4. You cannot take actual orders or reservations. If asked to place an order, guide them to use the online ordering system or call the restaurant.
5. Format your response beautifully using Markdown. You MUST bold (**text**) the names of dishes, prices, and important statuses like "Out of Stock".
6. If the user asks how to order, or expresses a desire to order food, you MUST include the exact text "[ORDER_BTN]" somewhere in your response.
7. UPSELLING: Whenever a customer asks about a specific dish, you MUST act like an experienced waiter and suggest 1 or 2 complementary items STRICTLY FROM THE PROVIDED "CURRENT MENU" ONLY. DO NOT invent or suggest ANY items, drinks, or teas that are not explicitly listed in the menu above. If the menu has no drinks, DO NOT suggest a drink. IMPORTANT: If the customer specifies a dietary restriction (e.g., "only non-veg", "only veg"), your upselling suggestions MUST also strictly adhere to that restriction. Keep the suggestion natural and polite.
8. ORDER HISTORY: If the user asks about their past orders or order history, politely ask them to provide their 10-digit phone number. If they provide a 10-digit phone number in the context of checking orders, your ENTIRE response MUST be exactly the text "[FETCH_ORDERS: <their_10_digit_number>]" and absolutely nothing else. Do not add any conversational text.
9. OUT OF STOCK ITEMS: If a customer asks for a specific dish that is marked as [OUT OF STOCK], politely inform them that the dish is currently out of stock or sold out for the day, and immediately suggest a similar alternative from the menu. DO NOT ever recommend an item that is [OUT OF STOCK]. Never say the word "Available" or "In Stock" in your response; just suggest the dish naturally.
10. RECOMMENDATIONS: If a user asks for a general recommendation, your best dish, or what is popular, you MUST check the "Best Seller" info in the RESTAURANT INFO section and follow its exact instructions. If a user asks for the best or most popular dish in a SPECIFIC category (e.g. "best rice", "best dessert"), you MUST recommend the corresponding item from the "Category Best Sellers" list in the RESTAURANT INFO section, taking note of its stock status.
11. PROMOTIONS & DISCOUNTS: If a user asks for a discount code, coupon, or active promotion, you MUST check the "Public Promotions" list in the RESTAURANT INFO section. If a code is listed, excitedly share the code and the discount amount. If no "Public Promotions" list is provided or it is empty, you MUST politely inform them that there are no active public promotions running at this time. NEVER invent or suggest a fake discount code.${categoryInstruction}
13. MENU ITEMS LIMIT: When listing items from a category or the general menu, NEVER list more than 5 items at a time in a single response to avoid crowding the chat window. If there are more than 5 items in that category, list the first 5 and then you MUST append this exact tag at the very end of your response: \`[LOAD_MORE_MENU: <Category Name>]\`.
14. GENERAL MENU REQUESTS: If a user broadly asks to see the menu, what you have, or your food options, DO NOT list specific menu items. Instead, you MUST list the available menu categories (following the CATEGORIES limit rule) and ask them what they are in the mood for.`;

    // 5. Prepare messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...messageHistory
    ];

    // 5. Call Groq
    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant", // Updated to current supported fast model
      temperature: 0.1,
      max_tokens: 256,
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that request right now.";
  } catch (error) {
    console.error("Groq AI Error:", error);
    throw error;
  }
}

module.exports = {
  chatWithGroq
};
