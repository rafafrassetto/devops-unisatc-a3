import { test, expect } from '@playwright/test';

const ADMIN_URL = 'http://localhost:1337/admin';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navega para a URL de administração e espera o DOM carregar
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    // Espera pelo campo de email no formulário de login
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });

    // Preenche o formulário de login
    await page.fill('input[name="email"]', 'admin@satc.edu.br');
    await page.fill('input[name="password"]', 'welcomeToStrapi123');
    // Clica no botão de submit e espera com timeout
    await page.click('button[type="submit"]', { timeout: 30000 });

    // Após o login, espera que a URL mude para o painel de admin
    await page.waitForURL(/admin/, { timeout: 60000 });
    
    // Espera por um seletor mais robusto para garantir que o painel de admin esteja completamente carregado.
    await page.waitForSelector('nav[aria-label="Side navigation"] >> text="Content Manager"', { state: 'visible', timeout: 60000 });
  });

  test('should create a new category', async ({ page }) => {
    // Clica no link "Collections" e depois no link "Categoria" na navegação lateral
    await page.click('nav[aria-label="Side navigation"] >> text="Collections"');
    await page.click('nav[aria-label="Side navigation"] >> text="Categoria"');
    // Espera que a URL de gerenciamento de categorias seja carregada
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    // Espera que o botão "Create new entry" esteja visível
    await page.waitForSelector('button:has-text("Create new entry")', { state: 'visible', timeout: 30000 });

    // Clica no botão "Create new entry"
    await page.click('button:has-text("Create new entry")');

    // Espera pelo campo de nome da nova categoria
    await page.waitForSelector('input[name="name"]', { timeout: 30000 });

    const categoryName = `Test Category ${Date.now()}`;
    await page.fill('input[name="name"]', categoryName);

    // Clica no botão "Save"
    await page.click('button:has-text("Save")');

    // Espera pela notificação de sucesso ou pela URL de redirecionamento, com timeout estendido
    await page.waitForSelector('text=Created successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notificação 'Created successfully' não encontrada, continuando com a verificação da URL.");
    });
    // Navega de volta para a lista de categorias e verifica se a categoria recém-criada está visível
    await page.goto('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector(`text="${categoryName}"`, { timeout: 30000 });
    expect(await page.textContent(`text="${categoryName}"`)).toBe(categoryName);
  });

  test('should edit an existing category', async ({ page }) => {
    // Clica no link "Collections" e depois no link "Categoria"
    await page.click('nav[aria-label="Side navigation"] >> text="Collections"');
    await page.click('nav[aria-label="Side navigation"] >> text="Categoria"');
    // Espera que a URL de gerenciamento de categorias seja carregada
    await page.waitForURL('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    // Espera que a primeira linha da tabela esteja visível antes de clicar
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible', timeout: 30000 });

    // Clica na primeira linha da tabela de categorias
    await page.locator('table tbody tr:first-child').click({ timeout: 30000 });

    // Espera pelo campo de nome da categoria para edição
    await page.waitForSelector('input[name="name"]', { timeout: 30000 });

    const updatedCategoryName = `Edited Category ${Date.now()}`;
    await page.fill('input[name="name"]', updatedCategoryName);

    // Clica no botão "Save"
    await page.click('button:has-text("Save")');

    // Espera pela notificação de sucesso ou pela URL de redirecionamento, com timeout estendido
    await page.waitForSelector('text=Updated successfully', { timeout: 20000 }).catch(() => {
        console.warn("Notificação 'Updated successfully' não encontrada, continuando com a verificação da URL.");
    });
    // Navega de volta para a lista de categorias e verifica se a categoria atualizada está visível
    await page.goto('**/content-manager/collectionType/api::categoria.categoria', { timeout: 60000 });
    await page.waitForSelector(`text="${updatedCategoryName}"`, { timeout: 30000 });
    expect(await page.textContent(`text="${updatedCategoryName}"`)).toBe(updatedCategoryName);
  });
});