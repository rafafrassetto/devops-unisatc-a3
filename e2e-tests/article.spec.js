import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Article Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.waitForSelector('input[name="email"]');

    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    await page.click('button[type="submit"]');

    await page.waitForURL(ADMIN_URL);
  });

  test('should create a new article', async ({ page }) => {
    await page.click('text=Collections');
    await page.click('text=Article');
    await page.waitForURL('**/content-manager/collectionType/api::article.article');

    await page.click('button:has-text("Create new entry")');

    await page.waitForSelector('input[name="title"]');

    const articleTitle = `Test Article ${Date.now()}`;
    await page.fill('input[name="title"]', articleTitle);
    await page.fill('textarea[name="content"]', 'This is a test content for the article.');

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Created successfully', { timeout: 10000 }).catch(() => {
        console.warn("Notification 'Created successfully' not found, proceeding with URL check.");
    });

    await page.goto('**/content-manager/collectionType/api::article.article');
    await page.waitForSelector(`text="${articleTitle}"`);
    expect(await page.textContent(`text="${articleTitle}"`)).toBe(articleTitle);
  });

  test('should view article details', async ({ page }) => {
    await page.click('text=Collections');
    await page.click('text=Article');
    await page.waitForURL('**/content-manager/collectionType/api::article.article');

    await page.locator('table tbody tr:first-child').click();

    await page.waitForSelector('input[name="title"]');
    expect(await page.locator('input[name="title"]').inputValue()).toBeTruthy();
    expect(await page.locator('textarea[name="content"]').inputValue()).toBeTruthy();
  });
});
