import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class ProductsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(query = ''): Promise<void> {
    await super.goto(`/products${query}`);
  }

  categoryFilterButton(category: string) {
    return this.page.locator('.filter-list').getByRole('button', { name: category, exact: true });
  }

  get sortSelect() {
    return this.page.getByRole('combobox');
  }

  get resultsCount() {
    return this.page.locator('.products-toolbar p');
  }

  get emptyState() {
    return this.page.getByText('No products found.');
  }

  get productCards() {
    return this.page.locator('.product-card');
  }

  productCard(name: string) {
    return this.page.locator('.product-card').filter({ hasText: name });
  }

  async addToCartByName(name: string): Promise<void> {
    await this.productCard(name).getByRole('button', { name: /Add to cart/i }).click();
  }
}
