'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global: globalData, about } = require('../data/data.json');

// Função principal para popular os dados de exemplo
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

// Verifica se é a primeira execução do script
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

// Define as permissões públicas para os endpoints da API
async function setPublicPermissions(newPermissions) {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  let publicRole = null;
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 2000;

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

// Obtém o tamanho de um arquivo em bytes
function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

// Obtém os metadados de um arquivo (caminho, nome original, tamanho, mimetype)
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

// Realiza o upload de um arquivo para o Strapi
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

// Cria uma nova entrada no Strapi para um modelo específico
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

// Verifica se o arquivo já existe antes de fazer upload, ou faz o upload
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

// Atualiza blocos de conteúdo para incluir arquivos carregados
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

// Importa artigos
async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    const categoryId = article.category ? article.category.id : null;
    const authorId = article.author ? article.author.id : null;

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        publishedAt: Date.now(),
        blocks: updatedBlocks,
        category: categoryId,
        author: authorId,
      },
    });
  }
  console.log('Articles imported.');
}

// Importa configurações globais
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

// Importa a página "Sobre"
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

// Importa categorias
async function importCategories() {
  for (const category of categories) {
    await strapi.query('api::category.category').create({ data: category });
  }
  console.log('Categories imported.');
}

// Importa autores
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

// Orquestra a importação de todos os dados de seed
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

module.exports = async () => {
  try {
    await seedExampleApp();
  } catch (error) {
    console.error('Seed script encountered an error:', error);
    process.exit(1);
  }
};