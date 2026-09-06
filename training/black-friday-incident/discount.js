// Stacked promo-code discount calculator used by checkout-service.
// NOTE: this module intentionally contains a bug for the training exercise
// in this folder. Do not copy it into the real app.

export function applyDiscount(amount, percentOff) {
  const discounted = amount * (1 - percentOff / 100);
  // Rounds to cents after EVERY discount step.
  return Math.round(discounted * 100) / 100;
}

// Applies each discount in sequence, rounding to the cent after each step.
// This is what checkout-service actually charges.
export function calculateStackedTotal(subtotal, discountPercents) {
  let total = subtotal;
  for (const pct of discountPercents) {
    total = applyDiscount(total, pct);
  }
  return Math.round(total * 100) / 100;
}

// Applies all discounts as one combined multiplier, rounding once at the end.
// This is what payment-gateway independently recomputes to validate the
// charge amount (its fraud/integrity check).
export function calculatePreciseTotal(subtotal, discountPercents) {
  let multiplier = 1;
  for (const pct of discountPercents) {
    multiplier *= 1 - pct / 100;
  }
  return Math.round(subtotal * multiplier * 100) / 100;
}
