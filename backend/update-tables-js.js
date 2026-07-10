const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'tables.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update session lookup to include coupon fields
content = content.replace(
  `"SELECT table_id FROM table_sessions WHERE id = $1 AND business_id = $2"`,
  `"SELECT table_id, coupon_code, discount_amount FROM table_sessions WHERE id = $1 AND business_id = $2"`
);

// 2. Add ensureBusinessSettings and calculateOrderTotals imports if not there
if (!content.includes('const { ensureBusinessSettings')) {
  content = content.replace(
    `const { ensureBusinessSettings, toBusinessResponse } = require("../utils/businessSettings");`,
    `const { ensureBusinessSettings, toBusinessResponse } = require("../utils/businessSettings");\nconst { calculateOrderTotals } = require("../utils/gst");`
  );
}

// 3. Update the response generation in GET /sessions/:sessionId/bill
const oldBillLogic = `
    const itemized = Array.from(aggregatedItems.values());
    const ordersList = Array.from(ordersMap.values());

    const finalSubtotal = roundCurrency(subtotal);
    const finalTotalPaid = roundCurrency(totalPaid);
    const finalTotalDue = roundCurrency(Math.max(0, finalSubtotal - finalTotalPaid));

    res.json({
      sessionId,
      tableNumber,
      orders: ordersList,
      itemized,
      totalAmount: finalSubtotal,
      totalPaid: finalTotalPaid,
      totalDue: finalTotalDue,
      isFullyPaid: finalTotalDue < 0.01 && ordersList.length > 0
    });`;

const newBillLogic = `
    const itemized = Array.from(aggregatedItems.values());
    const ordersList = Array.from(ordersMap.values());

    let finalTotalAmount = roundCurrency(subtotal);
    let sessionDetails = null;

    const couponCode = sessionRes.rows[0].coupon_code;
    const discountAmount = parseFloat(sessionRes.rows[0].discount_amount || 0);

    if (couponCode) {
      // If there is a session coupon, recalculate total from raw items
      let rawSubtotal = 0;
      for (const item of itemized) {
        rawSubtotal += item.totalPrice;
      }
      
      const businessSettings = await ensureBusinessSettings(pool, req.business_id);
      const totals = calculateOrderTotals({
        subtotal: rawSubtotal,
        discount: discountAmount,
        gstEnabled: businessSettings.isGstEnabled,
        cgstRate: businessSettings.cgstRate,
        sgstRate: businessSettings.sgstRate,
      });

      finalTotalAmount = totals.total;
      sessionDetails = {
        subtotal: totals.subtotal,
        discount: totals.discount,
        couponCode: couponCode,
        cgst: totals.cgst,
        sgst: totals.sgst,
        gstTotal: totals.gstTotal,
      };
    }

    const finalTotalPaid = roundCurrency(totalPaid);
    const finalTotalDue = roundCurrency(Math.max(0, finalTotalAmount - finalTotalPaid));

    res.json({
      sessionId,
      tableNumber,
      orders: ordersList,
      itemized,
      totalAmount: finalTotalAmount,
      totalPaid: finalTotalPaid,
      totalDue: finalTotalDue,
      isFullyPaid: finalTotalDue < 0.01 && ordersList.length > 0,
      sessionDetails
    });`;

content = content.replace(oldBillLogic, newBillLogic);

// 4. Append the two new routes before the module.exports
const newRoutes = `
// POST /api/tables/sessions/:sessionId/apply-coupon
router.post("/sessions/:sessionId/apply-coupon", async (req, res) => {
  const { sessionId } = req.params;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required" });

  try {
    // Validate session
    const sessionRes = await pool.query("SELECT * FROM table_sessions WHERE id = $1 AND business_id = $2 AND status != 'completed'", [sessionId, req.business_id]);
    if (!sessionRes.rows.length) return res.status(404).json({ error: "Active session not found" });

    // Validate coupon
    const normalizedCode = code.trim().toUpperCase();
    const couponRes = await pool.query("SELECT * FROM coupons WHERE code = $1 AND active = true AND business_id = $2", [normalizedCode, req.business_id]);
    if (!couponRes.rows.length) return res.status(400).json({ error: "Invalid or inactive coupon" });

    const coupon = couponRes.rows[0];

    // Check expiry
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    // Calculate raw subtotal for the session to compute discount
    const itemsRes = await pool.query(\`
      SELECT oi.price, oi.quantity FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.table_session_id = $1 AND o.status != 'cancelled' AND o.business_id = $2
    \`, [sessionId, req.business_id]);

    let rawSubtotal = 0;
    for (const row of itemsRes.rows) {
      rawSubtotal += (parseFloat(row.price) * parseInt(row.quantity));
    }

    if (coupon.min_order_amount && rawSubtotal < parseFloat(coupon.min_order_amount)) {
      return res.status(400).json({ error: \`Minimum order amount is ₹\${coupon.min_order_amount}\` });
    }

    let discountValue = 0;
    if (coupon.discount_type === "percent") {
      discountValue = rawSubtotal * (parseFloat(coupon.discount_value) / 100);
      if (coupon.max_discount_amount) {
        discountValue = Math.min(discountValue, parseFloat(coupon.max_discount_amount));
      }
    } else {
      discountValue = parseFloat(coupon.discount_value);
    }

    discountValue = Math.min(discountValue, rawSubtotal);

    await pool.query(
      "UPDATE table_sessions SET coupon_code = $1, discount_amount = $2 WHERE id = $3",
      [normalizedCode, discountValue, sessionId]
    );

    res.json({ success: true, message: "Coupon applied successfully" });
  } catch (err) {
    console.error("Apply coupon error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tables/sessions/:sessionId/remove-coupon
router.post("/sessions/:sessionId/remove-coupon", async (req, res) => {
  const { sessionId } = req.params;
  try {
    await pool.query(
      "UPDATE table_sessions SET coupon_code = NULL, discount_amount = 0 WHERE id = $1 AND business_id = $2",
      [sessionId, req.business_id]
    );
    res.json({ success: true, message: "Coupon removed" });
  } catch (err) {
    console.error("Remove coupon error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
`;

content = content.replace('module.exports = router;', newRoutes);

fs.writeFileSync(filePath, content);
console.log("Updated tables.js");
