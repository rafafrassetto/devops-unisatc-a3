'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global: globalData, about } = require('../data/data.json');

async function seedExampleApp() {
  try {
    console.log('Setting up the template...');
    await importSeedData();
    console.log('Ready to go');
  } catch (error) {
    console.log('Could not import seed data');
    console.error(error);
    throw error;
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}

// FUNÇÃO setPublicPermissions CORRIGIDA com retries
async function setPublicPermissions(newPermissions) {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  let publicRole = null;
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 2000; // 2 segundos

  for (let i = 0; i < MAX_RETRIES; i++) {
    const publicRoles = await strapi.entityService.findMany('plugin::users-permissions.role', {
      filters: { type: 'public' },
    });
    if (publicRoles && publicRoles.length > 0) {
      publicRole = publicRoles[0];
      console.log('Public role found after retry.');
      break;
    }
    console.warn(`Public role not found (attempt ${i + 1}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
  }

  if (!publicRole) {
    console.error('Failed to find public role after multiple retries, cannot set permissions.');
    throw new Error('Public role not found.');
  }

  const roleId = publicRole.id;
  let updatedPermissions = publicRole.permissions || [];

  for (const controller in newPermissions) {
    const actions = newPermissions[controller];
    for (const action of actions) {
      const actionId = `api::${controller}.${controller}.${action}`;
      
      let permissionFound = false;
      for (const perm of updatedPermissions) {
        if (perm.action === actionId) {
          perm.enabled = true;
          permissionFound = true;
          break;
        }
      }
      if (!permissionFound) {
        updatedPermissions.push({
          action: actionId,
          enabled: true,
        });
      }
    }
  }

  await pluginStore.set({
    key: 'role_public',
    value: {
      ...publicRole,
      permissions: updatedPermissions,
    },
  });
  console.log('Public permissions set in database.');
}

function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  const size = getFileSizeInBytes(filePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size,
    mimetype: mimeType,
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

async function createEntry({ model, entry }) {
  try {
    await strapi.query(`api::${model}.${model}`).create({
      data: entry,
    });
    console.log(`Created entry for model ${model}`);
  } catch (error) {
    console.error(`Error creating entry for model ${model}:`, error);
    throw error;
  }
}

async function checkFileExistsBeforeUpload(files) {
  const existingFiles = [];
  const uploadedFiles = [];
  const filesCopy = [...files];

  for (const fileName of filesCopy) {
    const fileWhereName = await strapi.query('plugin::upload.file').findOne({
      where: {
        name: fileName.replace(/\..*$/, ''),
      },
    });

    if (fileWhereName) {
      existingFiles.push(fileWhereName);
    } else {
      const fileData = getFileData(fileName);
      const fileNameNoExtension = fileName.split('.').shift();
      const [file] = await uploadFile(fileData, fileNameNoExtension);
      uploadedFiles.push(file);
    }
  }
  const allFiles = [...existingFiles, ...uploadedFiles];
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

async function updateBlocks(blocks) {
  const updatedBlocks = [];
  for (const block of blocks) {
    if (block.__component === 'shared.media') {
      const uploadedFiles = await checkFileExistsBeforeUpload([block.file]);
      const blockCopy = { ...block };
      blockCopy.file = uploadedFiles;
      updatedBlocks.push(blockCopy);
    } else if (block.__component === 'shared.slider') {
      const existingAndUploadedFiles = await checkFileExistsBeforeUpload(block.files);
      const blockCopy = { ...block };
      blockCopy.files = existingAndUploadedFiles;
      updatedBlocks.push(blockCopy);
    } else {
      updatedBlocks.push(block);
    }
  }
  return updatedBlocks;
}

// ImportArticles CORRIGIDO para usar IDs diretamente do data.json
async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    // Agora passa diretamente o valor numérico do ID
    const categoryId = article.category ? article.category.id : null;
    const authorId = article.author ? article.author.id : null;

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        publishedAt: Date.now(),
        blocks: updatedBlocks,
        category: categoryId, // Passa apenas o ID numérico
        author: authorId,     // Passa apenas o ID numérico
      },
    });
  }
  console.log('Articles imported.');
}

async function importGlobal() {
  const favicon = await checkFileExistsBeforeUpload(['favicon.png']);
  const shareImage = await checkFileExistsBeforeUpload(['default-image.png']);
  await createEntry({
    model: 'global',
    entry: {
      ...globalData,
      favicon,
      publishedAt: Date.now(),
      defaultSeo: {
        ...globalData.defaultSeo,
        shareImage,
      },
    },
  });
  console.log('Global settings imported.');
}

async function importAbout() {
  const updatedBlocks = await updateBlocks(about.blocks);

  await createEntry({
    model: 'about',
    entry: {
      ...about,
      publishedAt: Date.now(),
      blocks: updatedBlocks,
    },
  });
  console.log('About page imported.');
}

// As funções importCategories e importAuthors não precisam armazenar em 'importedCategories' e 'importedAuthors'
// pois 'importArticles' agora usa os IDs do data.json diretamente.
// Elas ainda precisam criar as entradas para que os IDs existam.
async function importCategories() {
  for (const category of categories) {
    await strapi.query('api::category.category').create({ data: category });
  }
  console.log('Categories imported.');
}

async function importAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);
    await strapi.query('api::author.author').create({
      data: {
        ...author,
        avatar,
      },
    });
  }
  console.log('Authors imported.');
}

async function importSeedData() {
  console.log('Setting public permissions for API endpoints...');
  await setPublicPermissions({
    article: ['find', 'findOne'],
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    global: ['find', 'findOne'],
    about: ['find', 'findOne'],
  });
  console.log('Public permissions set.');

  // ORDEM IMPORTA: Importar categorias e autores ANTES dos artigos
  console.log('Importing categories...');
  await importCategories();
  console.log('Importing authors...');
  await importAuthors();
  
  console.log('Importing articles...');
  await importArticles();
  console.log('Importing global settings...');
  await importGlobal();
  console.log('Importing about page...');
  await importAbout();
}

async function main() {
  const { createStrapi, compileStraapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'warn';
  await seedExampleApp();
  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed script encountered an error:', error);
  process.exit(1);
});