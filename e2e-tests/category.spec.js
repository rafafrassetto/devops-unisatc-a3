import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.waitForSelector('input[name="email"]');

    // Preenche o formulário de login
    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    await page.click('button[type="submit"]');

    await page.waitForURL(ADMIN_URL);
  });

  test('should create a new category', async ({ page }) => {
    // Navega para a coleção 'Categorias'
    await page.click('text=Collections');
    await page.click('text=Categoria');
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria');

    await page.click('button:has-text("Create new entry")');

    await page.waitForSelector('input[name="name"]');

    const categoryName = `Test Category ${Date.now()}`;
    await page.fill('input[name="name"]', categoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Created successfully', { timeout: 10000 }).catch(() => {
        console.warn("Notification 'Created successfully' not found, proceeding with URL check.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector(`text="${categoryName}"`);
    expect(await page.textContent(`text="${categoryName}"`)).toBe(categoryName);
  });

  test('should edit an existing category', async ({ page }) => {
    await page.click('text=Collections');
    await page.click('text=Categoria');
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria');

    await page.locator('table tbody tr:first-child').click();

    await page.waitForSelector('input[name="name"]');

    const updatedCategoryName = `Edited Category ${Date.now()}`;
    await page.fill('input[name="name"]', updatedCategoryName);

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Updated successfully', { timeout: 10000 }).catch(() => {
        console.warn("Notification 'Updated successfully' not found, proceeding with URL check.");
    });
    await page.goto('**/content-manager/collectionType/api::categoria.categoria');
    await page.waitForSelector(`text="${updatedCategoryName}"`);
    expect(await page.textContent(`text="${updatedCategoryName}"`)).toBe(updatedCategoryName);
  });
});
