import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(60 * 1000);

    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[name="email"]');

    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    await page.click('button[type="submit"]');

    await page.waitForURL(/admin/);
    await page.waitForSelector('nav[aria-label="Side navigation"] a:has-text("Content Manager")', { state: 'visible', timeout: 90000 });
    await page.click('nav[aria-label="Side navigation"] a:has-text("Content Manager")');
  });

  test('should create a new category', async ({ page }) => {
    await page.click('nav[aria-label="Side navigation"] a:has-text("Collections")');
    await page.click('nav[aria-label="Side navigation"] a:has-text("Categoria")');
    
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector('button:has-text("Create new entry")', { state: 'visible' });

    await page.click('button:has-text("Create new entry")');

    await page.waitForSelector('input[name="name"]');

    const categoryName = `Test Category ${Date.now()}`;
    await page.fill('input[name="name"]', categoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Created successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notificação 'Created successfully' não encontrada, continuando com a verificação da URL.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector(`text="${categoryName}"`);
    expect(await page.textContent(`text="${categoryName}"`)).toBe(categoryName);
  });

  test('should edit an existing category', async ({ page }) => {
    await page.click('nav[aria-label="Side navigation"] a:has-text("Collections")');
    await page.click('nav[aria-label="Side navigation"] a:has-text("Categoria")');
    
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });

    await page.locator('table tbody tr:first-child').click();

    await page.waitForSelector('input[name="name"]');

    const updatedCategoryName = `Edited Category ${Date.now()}`;
    await page.fill('input[name="name"]', updatedCategoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Updated successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notificação 'Updated successfully' não encontrada, continuando com a verificação da URL.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector(`text="${updatedCategoryName}"`);
    expect(await page.textContent(`text="${updatedCategoryName}"`)).toBe(updatedCategoryName);
  });
});