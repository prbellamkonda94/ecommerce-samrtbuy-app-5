import { expect, test } from '@playwright/test';
import { ProductDetailPage } from '../pages/product-detail.page.js';
import { CartPage } from '../pages/cart.page.js';
import { CheckoutPage } from '../pages/checkout.page.js';
import { OrderConfirmationPage } from '../pages/order-confirmation.page.js';
import { ROBOT_VACUUM, VALID_SHIPPING } from '../fixtures/catalog.js';

// The invariant CLAUDE.md calls out by name: "POST /api/orders ... clamps
// quantity to available stock" in server/routes/orders.js. The product
// detail page's own qty input clamps client-side (see
// product-browsing.spec.ts), but the cart page's qty input does not -- its
// onChange handler only enforces a minimum of 1, not the product's stock
// (src/pages/Cart.jsx). So a requested quantity past stock can reach the
// server; this test is the one most worth running before any change to
// server/routes/orders.js.
test('ordering more than available stock is clamped server-side, not silently accepted', async ({ page }) => {
  const requestedQty = ROBOT_VACUUM.stock! + 40;

  const detail = new ProductDetailPage(page);
  await detail.goto(ROBOT_VACUUM.id);
  await detail.addToCartButton.click();

  const cart = new CartPage(page);
  await cart.goto();
  // Bypasses the qty input's HTML `max` attribute, the same way typing a
  // number directly does -- Cart.jsx's onChange does not clamp to stock.
  await cart.setQty(ROBOT_VACUUM.name, requestedQty);
  await expect(cart.qtyInput(ROBOT_VACUUM.name)).toHaveValue(String(requestedQty));

  await cart.checkoutLink.click();
  const checkout = new CheckoutPage(page);
  await checkout.fillShipping(VALID_SHIPPING);
  await checkout.submit();

  await page.waitForURL(/\/order-confirmation\//);
  const confirmation = new OrderConfirmationPage(page);

  // The order actually stored (and now re-fetched from the server) must
  // reflect the clamped quantity and its price, not what was requested.
  await expect(confirmation.lineItem(ROBOT_VACUUM.name)).toContainText(`× ${ROBOT_VACUUM.stock}`);
  const clampedTotal = (ROBOT_VACUUM.price * ROBOT_VACUUM.stock!).toFixed(2);
  await expect(confirmation.totalRow).toContainText(`$${clampedTotal}`);
});
