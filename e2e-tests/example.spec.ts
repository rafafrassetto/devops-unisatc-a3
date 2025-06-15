import { test, expect } from '@playwright/test';

test('has title and welcome message', async ({ page }) => {

  await page.goto(process.env.BASE_URL || 'http://localhost:80');

  await expect(page).toHaveTitle(/Minha Aplicação DevOps/);

  await expect(page.locator('h1')).toHaveText('Deploy de HTML Estático com Sucesso!');

  await expect(page.locator('p').first()).toHaveText('Esta é a sua aplicação de teste para o A3 de DevOps.');

  await expect(page.locator('p').nth(2)).toHaveText('Equipe : Rafael Frassetto Pereira');
});