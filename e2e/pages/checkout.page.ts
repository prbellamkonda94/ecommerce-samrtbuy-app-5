import type { Page } from '@playwright/test';
import { BasePage } from './base.page.js';

export interface ShippingDetails {
  fullName: string;
  address: string;
  city: string;
  zip: string;
  cardNumber: string;
}

export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await super.goto('/checkout');
  }

  get fullNameInput() {
    return this.page.getByLabel('Full Name');
  }

  get addressInput() {
    return this.page.getByLabel('Address');
  }

  get cityInput() {
    return this.page.getByLabel('City');
  }

  get zipInput() {
    return this.page.getByLabel('ZIP Code');
  }

  get cardNumberInput() {
    return this.page.getByLabel('Card Number');
  }

  get placeOrderButton() {
    return this.page.getByRole('button', { name: /Place Order/ });
  }

  get submitError() {
    return this.page.locator('form > .field-error');
  }

  /** Error text nested inside the <label> for the given field, e.g.
   * "ZIP Code" -> the `.field-error` shown after an invalid submit. */
  fieldError(label: string) {
    return this.page.locator('label', { hasText: label }).locator('.field-error');
  }

  async fillShipping(details: Partial<ShippingDetails>): Promise<void> {
    if (details.fullName !== undefined) await this.fullNameInput.fill(details.fullName);
    if (details.address !== undefined) await this.addressInput.fill(details.address);
    if (details.city !== undefined) await this.cityInput.fill(details.city);
    if (details.zip !== undefined) await this.zipInput.fill(details.zip);
    if (details.cardNumber !== undefined) await this.cardNumberInput.fill(details.cardNumber);
  }

  async submit(): Promise<void> {
    await this.placeOrderButton.click();
  }
}
