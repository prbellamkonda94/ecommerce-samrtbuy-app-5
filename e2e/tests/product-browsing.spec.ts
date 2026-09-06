import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';
import { NavPage } from '../pages/nav.page.js';
import { ProductsPage } from '../pages/products.page.js';
import { ProductDetailPage } from '../pages/product-detail.page.js';
import { BOOKS_CATEGORY, BOOKS_COUNT, HEADPHONES, MIDNIGHT_LIBRARY, ROBOT_VACUUM } from '../fixtures/catalog.js';

test.describe('browsing the catalog', () => {
  test('home page shows categories and top-rated products, and links to shop', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.topRatedHeading).toBeVisible();
    await expect(page.locator('.category-tile')).toHaveCount(6);

    await home.startShoppingLink.click();
    await expect(page).toHaveURL('/products');
  });

  test('category tile navigates to a pre-filtered product list', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await home.categoryTile(BOOKS_CATEGORY).click();
    await expect(page).toHaveURL(`/products?category=${BOOKS_CATEGORY}`);

    const products = new ProductsPage(page);
    await expect(products.resultsCount).toHaveText(`${BOOKS_COUNT} results`);
  });

  test('header search finds a specific product', async ({ page }) => {
    await page.goto('/products');
    const nav = new NavPage(page);
    await nav.search('Headphones');

    const products = new ProductsPage(page);
    await expect(products.resultsCount).toHaveText(`1 result for "Headphones"`);
    await expect(products.productCard(HEADPHONES.name)).toBeVisible();
  });

  test('sidebar category filter narrows results', async ({ page }) => {
    const products = new ProductsPage(page);
    await products.goto();

    await products.categoryFilterButton(BOOKS_CATEGORY).click();
    await expect(page).toHaveURL(`/products?category=${BOOKS_CATEGORY}`);
    await expect(products.resultsCount).toHaveText(`${BOOKS_COUNT} results`);
    await expect(products.productCards).toHaveCount(BOOKS_COUNT);

    await products.categoryFilterButton('All').click();
    await expect(page).toHaveURL('/products');
  });

  test('sort by price (low to high) reorders results within a category', async ({ page }) => {
    const products = new ProductsPage(page);
    await products.goto(`?category=${BOOKS_CATEGORY}`);

    await products.sortSelect.selectOption('price-asc');

    // The Midnight Library ($13.50) is the cheapest book in the seeded
    // catalog -- see shared/catalog.js -- so it must sort first.
    await expect(products.productCards.first()).toContainText(MIDNIGHT_LIBRARY.name);
  });

  test('searching for a nonexistent product shows the empty state', async ({ page }) => {
    const products = new ProductsPage(page);
    await products.goto();

    const nav = new NavPage(page);
    await nav.search('zzz-does-not-exist-zzz');

    await expect(products.emptyState).toBeVisible();
  });

  test('product detail page shows details and clamps quantity to available stock', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(ROBOT_VACUUM.id);

    await expect(detail.heading).toHaveText(ROBOT_VACUUM.name);
    await expect(detail.stockStatus).toHaveText(`In stock (${ROBOT_VACUUM.stock} available)`);

    // Typing past available stock clamps client-side (unlike the cart
    // page's qty input -- see stock-clamping.spec.ts for the case where it
    // doesn't, and the server has to catch it).
    await detail.quantityInput.fill('999');
    await detail.quantityInput.blur();
    await expect(detail.quantityInput).toHaveValue(String(ROBOT_VACUUM.stock));
  });

  test('an unknown product id shows "Product not found"', async ({ page }) => {
    const detail = new ProductDetailPage(page);
    await detail.goto(999999);

    await expect(detail.notFoundMessage).toBeVisible();
  });

  test('an unknown route shows the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
  });
});
