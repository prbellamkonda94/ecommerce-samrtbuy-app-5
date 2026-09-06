import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

// Header/nav chrome present on every page (src/components/Header.jsx) --
// every spec ends up depending on it, so it gets its own page object even
// though it isn't a routed page.
export class NavPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get searchInput() {
    return this.page.getByLabel('Search products');
  }

  get searchButton() {
    return this.page.getByRole('button', { name: 'Search' });
  }

  get shopLink() {
    return this.page.getByRole('link', { name: 'Shop' });
  }

  get ordersLink() {
    return this.page.getByRole('link', { name: 'Orders' });
  }

  get cartLink() {
    return this.page.getByRole('link', { name: /Cart/ });
  }

  get cartBadge() {
    return this.page.locator('.cart-badge');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }
}
