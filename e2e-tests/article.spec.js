import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Article Management', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(60 * 1000);

    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[name="email"]');

    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    await page.click('button[type="submit"]');

    await page.waitForURL(/admin/);
    await page.waitForSelector('nav[aria-label="Side navigation"] a:has-text("Content Manager")', { state: 'visible', timeout: 60000 });
    await page.click('nav[aria-label="Side navigation"] a:has-text("Content Manager")');
  });

  test('should create a new article', async ({ page }) => {
    await page.click('nav[aria-label="Side navigation"] a:has-text("Collections")');
    await page.click('nav[aria-label="Side navigation"] a:has-text("Article")');
    
    await page.waitForURL('**/content-manager/collectionType/api::article.article');
    await page.waitForSelector('button:has-text("Create new entry")', { state: 'visible' });

    await page.click('button:has-text("Create new entry")');

    await page.waitForSelector('input[name="title"]');

    const articleTitle = `Test Article ${Date.now()}`;
    await page.fill('input[name="title"]', articleTitle);
    await page.fill('textarea[name="content"]', 'This is a test content for the article.');

    await page.click('button:has-text("Save")');

    await page.waitForSelector('text=Created successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notificação 'Created successfully' não encontrada, continuando com a verificação da URL.");
    });

    await page.goto('**/content-manager/collectionType/api::article.article');
    await page.waitForSelector(`text="${articleTitle}"`);
    expect(await page.textContent(`text="${articleTitle}"`)).toBe(articleTitle);
  });

  test('should view article details', async ({ page }) => {
    await page.click('nav[aria-label="Side navigation"] a:has-text("Collections")');
    await page.click('nav[aria-label="Side navigation"] a:has-text("Article")');
    
    await page.waitForURL('**/content-manager/collectionType/api::article.article');
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });

    await page.locator('table tbody tr:first-child').click();

    await page.waitForSelector('input[name="title"]');
    expect(await page.locator('input[name="title"]').inputValue()).toBeTruthy();
    expect(await page.locator('textarea[name="content"]').inputValue()).toBeTruthy();
  });
});