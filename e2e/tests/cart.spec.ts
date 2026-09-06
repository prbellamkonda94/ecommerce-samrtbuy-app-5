import { expect, test } from '@playwright/test';
import { NavPage } from '../pages/nav.page.js';
import { ProductsPage } from '../pages/products.page.js';
import { ProductDetailPage } from '../pages/product-detail.page.js';
import { CartPage } from '../pages/cart.page.js';
import { BEANIE, HEADPHONES } from '../fixtures/catalog.js';

test.describe('cart', () => {
  test('adding from the product grid updates the header cart badge', async ({ page }) => {
    const products = new ProductsPage(page);
    await products.goto();
    await products.addToCartByName(BEANIE.name);

    const nav = new NavPage(page);
    await expect(nav.cartBadge).toHaveText('1');

    await products.addToCartByName(BEANIE.name);
    await expect(nav.cartBadge).toHaveText('2');
  });

  test('adding a custom quantity from the product detail page', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);

    await detail.increaseQtyButton.click();
    await detail.increaseQtyButton.click();
    await expect(detail.quantityInput).toHaveValue('3');
    await detail.addToCartButton.click();

    const nav = new NavPage(page);
    await expect(nav.cartBadge).toHaveText('3');
  });

  test('cart under the free-shipping threshold charges $5.99 shipping', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id); // $14.99 -- well under the $50 free-shipping threshold
    await detail.addToCartButton.click();

    const cart = new CartPage(page);
    await cart.goto();
    await expect(cart.subtotalRow).toContainText('$14.99');
    await expect(cart.shippingRow).toContainText('$5.99');
    await expect(cart.totalRow).toContainText('$20.98');
  });

  test('cart over the free-shipping threshold shows free shipping', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(HEADPHONES.id); // $129.99 -- over the $50 threshold on its own
    await detail.addToCartButton.click();

    const cart = new CartPage(page);
    await cart.goto();
    await expect(cart.shippingRow).toContainText('Free');
    await expect(cart.totalRow).toContainText('$129.99');
  });

  test('updating quantity and removing an item recalculates the summary', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.addToCartButton.click();

    const cart = new CartPage(page);
    await cart.goto();
    await cart.setQty(BEANIE.name, 2);
    await expect(cart.cartItem(BEANIE.name)).toContainText('$29.98');

    await cart.removeButton(BEANIE.name).click();
    await expect(cart.emptyState).toBeVisible();
  });

  test('clear cart empties it', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.addToCartButton.click();

    const cart = new CartPage(page);
    await cart.goto();
    await cart.clearCartButton.click();

    await expect(cart.emptyState).toBeVisible();
    const nav = new NavPage(page);
    await expect(nav.cartBadge).toBeHidden();
  });

  test('cart survives a full page reload (persisted to localStorage)', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(BEANIE.id);
    await detail.addToCartButton.click();

    const nav = new NavPage(page);
    await expect(nav.cartBadge).toHaveText('1');

    await page.reload();
    await expect(nav.cartBadge).toHaveText('1');

    const cart = new CartPage(page);
    await cart.goto();
    await expect(cart.cartItem(BEANIE.name)).toBeVisible();
  });
});
