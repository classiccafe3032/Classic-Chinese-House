const DEFAULT_CGST_RATE = 2.5;
const DEFAULT_SGST_RATE = 2.5;

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function calculateOrderTotals({
  subtotal,
  discount = 0,
  gstEnabled = true,
  cgstRate = DEFAULT_CGST_RATE,
  sgstRate = DEFAULT_SGST_RATE,
}) {
  const safeSubtotal = roundCurrency(subtotal);
  const safeDiscount = roundCurrency(Math.min(Math.max(discount, 0), safeSubtotal));
  const taxableAmount = roundCurrency(Math.max(safeSubtotal - safeDiscount, 0));

  const activeCgst = gstEnabled ? Number((Number(cgstRate) || 0).toFixed(4)) : 0;
  const activeSgst = gstEnabled ? Number((Number(sgstRate) || 0).toFixed(4)) : 0;

  const cgst = roundCurrency(taxableAmount * activeCgst / 100);
  const sgst = roundCurrency(taxableAmount * activeSgst / 100);
  const gstTotal = roundCurrency(cgst + sgst);
  const total = roundCurrency(taxableAmount + gstTotal);

  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    taxableAmount,
    cgst,
    sgst,
    gstTotal,
    cgstRate: activeCgst,
    sgstRate: activeSgst,
    gstRate: roundCurrency(activeCgst + activeSgst),
    total,
  };
}

module.exports = {
  DEFAULT_CGST_RATE,
  DEFAULT_SGST_RATE,
  roundCurrency,
  calculateOrderTotals,
};
