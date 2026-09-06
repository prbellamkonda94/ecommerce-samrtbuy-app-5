import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class CartPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await super.goto('/cart');
  }

  get emptyState() {
    return this.page.getByText('Your cart is empty.');
  }

  cartItem(name: string) {
    return this.page.locator('.cart-item').filter({ hasText: name });
  }

  qtyInput(name: string) {
    return this.cartItem(name).locator('input[type="number"]');
  }

  removeButton(name: string) {
    return this.cartItem(name).getByRole('button', { name: 'Remove item' });
  }

  get clearCartButton() {
    return this.page.getByRole('button', { name: 'Clear cart' });
  }

  get subtotalRow() {
    return this.page.locator('.summary-row').filter({ hasText: 'Subtotal' });
  }

  get shippingRow() {
    return this.page.locator('.summary-row').filter({ hasText: 'Shipping' });
  }

  get totalRow() {
    return this.page.locator('.summary-total');
  }

  get checkoutLink() {
    return this.page.getByRole('link', { name: 'Proceed to Checkout' });
  }

  /** Sets a cart line's quantity via direct value assignment (bypasses the
   * input's `max` attribute the way a user typing a number would -- see
   * stock-clamping.spec.ts, which relies on this to exceed stock client-side
   * and verify the server clamps it on order placement). */
  async setQty(name: string, qty: number): Promise<void> {
    await this.qtyInput(name).fill(String(qty));
    await this.qtyInput(name).blur();
  }
}
