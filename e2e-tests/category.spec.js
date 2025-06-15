import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[name="email"]');

    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    await page.click('button[type="submit"]');

    await page.waitForURL(/admin/, { timeout: 60000 });
    await page.waitForSelector('text="Content Manager"', { state: 'visible', timeout: 60000 });
  });

  test('should create a new category', async ({ page }) => {
    await page.click('text=Collections');
    await page.click('text=Categoria');
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector('button:has-text("Create new entry")', { state: 'visible', timeout: 30000 });

    await page.click('button:has-text("Create new entry")');

    await page.waitForSelector('input[name="name"]', { timeout: 30000 });

    const categoryName = `Test Category ${Date.now()}`;
    await page.fill('input[name="name"]', categoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Created successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notification 'Created successfully' not found, proceeding with URL check.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector(`text="${categoryName}"`, { timeout: 30000 });
    expect(await page.textContent(`text="${categoryName}"`)).toBe(categoryName);
  });

  test('should edit an existing category', async ({ page }) => {
    await page.click('text=Collections');
    await page.click('text=Categoria');
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible', timeout: 30000 });

    await page.locator('table tbody tr:first-child').click({ timeout: 30000 });

    await page.waitForSelector('input[name="name"]', { timeout: 30000 });

    const updatedCategoryName = `Edited Category ${Date.now()}`;
    await page.fill('input[name="name"]', updatedCategoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Updated successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notification 'Updated successfully' not found, proceeding with URL check.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector(`text="${updatedCategoryName}"`, { timeout: 30000 });
    expect(await page.textContent(`text="${updatedCategoryName}"`)).toBe(updatedCategoryName);
  });
});