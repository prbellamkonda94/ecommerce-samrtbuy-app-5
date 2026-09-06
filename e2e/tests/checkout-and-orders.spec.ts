import { expect, test } from '@playwright/test';
import { ProductDetailPage } from '../pages/product-detail.page.js';
import { CartPage } from '../pages/cart.page.js';
import { CheckoutPage } from '../pages/checkout.page.js';
import { OrderConfirmationPage } from '../pages/order-confirmation.page.js';
import { OrdersPage } from '../pages/orders.page.js';
import { BEANIE, VALID_SHIPPING } from '../fixtures/catalog.js';

test.describe('checkout validation', () => {
  test('visiting checkout with an empty cart redirects to the cart page', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await expect(page).toHaveURL('/cart');
  });

  test('submitting the checkout form empty shows required-field errors', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.addToCartButton.click();

    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.submit();

    await expect(checkout.fieldError('Full Name')).toHaveText('Full name is required');
    await expect(checkout.fieldError('Address')).toHaveText('Address is required');
    await expect(checkout.fieldError('City')).toHaveText('City is required');
    await expect(checkout.fieldError('ZIP Code')).toHaveText('Enter a valid ZIP code');
    await expect(checkout.fieldError('Card Number')).toHaveText('Enter a valid card number');
    // No navigation happened -- still on checkout.
    await expect(page).toHaveURL('/checkout');
  });

  test('an invalid ZIP or card number is rejected without hitting the server', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.addToCartButton.click();

    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.fillShipping({ ...VALID_SHIPPING, zip: 'not-a-zip', cardNumber: '123' });
    await checkout.submit();

    await expect(checkout.fieldError('ZIP Code')).toHaveText('Enter a valid ZIP code');
    await expect(checkout.fieldError('Card Number')).toHaveText('Enter a valid card number');
    await expect(page).toHaveURL('/checkout');
  });
});

test.describe('checkout happy path', () => {
  test('browse -> cart -> checkout -> confirmation -> appears in order history', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.buyNowButton.click();
    await expect(page).toHaveURL('/cart');

    const cart = new CartPage(page);
    await cart.checkoutLink.click();
    await expect(page).toHaveURL('/checkout');

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping(VALID_SHIPPING);
    await checkout.submit();

    await page.waitForURL(/\/order-confirmation\//);
    const confirmation = new OrderConfirmationPage(page);
    await expect(confirmation.heading).toBeVisible();
    await expect(confirmation.lineItem(BEANIE.name)).toContainText('$14.99');
    // $14.99 subtotal + $5.99 shipping (under the free-shipping threshold).
    await expect(confirmation.totalRow).toContainText('$20.98');

    const orderId = (await confirmation.orderId.textContent())?.trim();
    expect(orderId).toMatch(/^ORD-/);

    await confirmation.viewOrdersLink.click();
    await expect(page).toHaveURL('/orders');

    const orders = new OrdersPage(page);
    await expect(orders.orderCard(orderId!)).toBeVisible();
    await expect(orders.orderCard(orderId!)).toContainText('$20.98');
  });

  test('an unknown order id shows "Order not found"', async ({ page }) => {
    const confirmation = new OrderConfirmationPage(page);
    await confirmation.goto('ORD-DOES-NOT-EXIST');

    await expect(confirmation.notFoundMessage).toBeVisible();
  });
});
