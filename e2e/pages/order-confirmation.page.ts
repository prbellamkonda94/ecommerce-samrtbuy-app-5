import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export class OrderConfirmationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(orderId: string): Promise<void> {
    await super.goto(`/order-confirmation/${orderId}`);
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Order Confirmed!' });
  }

  get orderId() {
    return this.page.locator('.order-id strong');
  }

  lineItem(name: string) {
    return this.page.locator('.order-details .summary-row').filter({ hasText: name });
  }

  get totalRow() {
    return this.page.locator('.order-details .summary-total');
  }

  get notFoundMessage() {
    return this.page.getByText(/Order not found/);
  }

  get viewOrdersLink() {
    return this.page.getByRole('link', { name: 'View Orders' });
  }
}
