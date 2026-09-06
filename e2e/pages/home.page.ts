import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  get startShoppingLink() {
    return this.page.getByRole('link', { name: 'Start Shopping' });
  }

  get topRatedHeading() {
    return this.page.getByRole('heading', { name: 'Top Rated Picks' });
  }

  categoryTile(category: string) {
    return this.page.getByRole('link', { name: new RegExp(category) });
  }
}
