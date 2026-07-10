const express = require('express');
const router = express.Router();
const { chatWithGroq } = require('../services/aiService');
const pool = require('../db/pool');

async function generateOrderHistoryText(pool, businessId, phone, page = 1) {
  const limit = 5;
  const offset = (page - 1) * limit;

  let summaryText = "";
  if (page === 1) {
    const aggRes = await pool.query(
      `SELECT COUNT(*) as total_orders, SUM(total) as total_spent, AVG(total) as avg_order 
       FROM orders WHERE customer_phone = $1 AND business_id = $2`,
       [phone, businessId]
    );
    const stats = aggRes.rows[0];
    if (stats.total_orders == 0) {
      return "I couldn't find any past orders associated with that phone number. Are you sure you've ordered with us before using this number?";
    }

    const favRes = await pool.query(
      `SELECT oi.name, SUM(oi.quantity) as times_ordered 
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.customer_phone = $1 AND o.business_id = $2
       GROUP BY oi.name
       ORDER BY times_ordered DESC LIMIT 1`,
       [phone, businessId]
    );

    const totalSpent = Number(stats.total_spent || 0).toFixed(0);
    const avgOrder = Number(stats.avg_order || 0).toFixed(0);
    summaryText = `Welcome back! You've placed ${stats.total_orders} orders with us, spending a total of ₹${totalSpent}. Your average order is ₹${avgOrder}. `;
    
    if (favRes.rows.length > 0) {
      summaryText += `Your absolute favorite dish seems to be **${favRes.rows[0].name}** (ordered ${favRes.rows[0].times_ordered} times)! \n\n`;
    }
    summaryText += `Here are your most recent orders:\n\n`;
  }

  const ordersRes = await pool.query(
    `SELECT id, created_at, total, status 
     FROM orders 
     WHERE customer_phone = $1 AND business_id = $2
     ORDER BY created_at DESC 
     LIMIT $3 OFFSET $4`,
     [phone, businessId, limit + 1, offset]
  );

  const orders = ordersRes.rows.slice(0, limit);
  const hasNextPage = ordersRes.rows.length > limit;

  if (orders.length === 0 && page > 1) {
    return "No more orders found.";
  }

  let ordersText = "";
  for (const order of orders) {
    const dateStr = new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const itemsRes = await pool.query(
      `SELECT name, quantity FROM order_items WHERE order_id = $1`, [order.id]
    );
    
    const itemsList = itemsRes.rows.map(item => `${item.quantity}x ${item.name}`).join(", ");
    
    ordersText += `• **${dateStr}** - ₹${Number(order.total).toFixed(0)}\n  _${itemsList}_\n\n`;
  }

  let finalResponse = summaryText + ordersText.trim();
  
  if (hasNextPage) {
    finalResponse += `\n\n[LOAD_MORE_ORDERS:${phone}:${page + 1}]`;
  }

  return finalResponse;
}

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const businessId = req.business_id;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    // Basic validation to prevent excessively large histories
    if (messages.length > 20) {
      return res.status(400).json({ error: 'Message history too long' });
    }

    // Ensure all messages have role and content
    const isValid = messages.every(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    let reply = await chatWithGroq(messages, businessId);
    
    const fetchMatch = reply.match(/\[FETCH_ORDERS:\s*(\d{10})\]/);
    if (fetchMatch) {
      const phone = fetchMatch[1];
      const orderData = await generateOrderHistoryText(pool, businessId, phone, 1);
      reply = reply.replace(/\[FETCH_ORDERS:\s*\d{10}\]/, orderData);
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

router.get('/orders/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const page = parseInt(req.query.page) || 1;
    const businessId = req.business_id;

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    const orderData = await generateOrderHistoryText(pool, businessId, phone, page);
    res.json({ text: orderData });
  } catch (error) {
    console.error('Fetch orders endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

module.exports = router;
