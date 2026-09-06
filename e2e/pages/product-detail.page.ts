import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class ProductDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(id: number): Promise<void> {
    await super.goto(`/products/${id}`);
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get quantityInput() {
    return this.page.locator('#qty');
  }

  get increaseQtyButton() {
    return this.page.getByRole('button', { name: 'Increase quantity' });
  }

  get decreaseQtyButton() {
    return this.page.getByRole('button', { name: 'Decrease quantity' });
  }

  get addToCartButton() {
    return this.page.getByRole('button', { name: /Add to Cart|Added/ });
  }

  get buyNowButton() {
    return this.page.getByRole('button', { name: 'Buy Now' });
  }

  get stockStatus() {
    return this.page.locator('.stock-status');
  }

  get notFoundMessage() {
    return this.page.getByText(/Product not found/);
  }
}
