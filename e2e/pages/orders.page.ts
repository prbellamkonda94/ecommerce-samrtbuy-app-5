import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class OrdersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await super.goto('/orders');
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'My Orders' });
  }

  get emptyState() {
    return this.page.getByText("You haven't placed any orders yet.");
  }

  orderCard(orderId: string) {
    return this.page.locator('.order-card').filter({ hasText: orderId });
  }
}
