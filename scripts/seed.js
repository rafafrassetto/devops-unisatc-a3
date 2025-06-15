'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
// Renomeie 'global' para 'globalData' para evitar conflito com a palavra-chave global
const { categories, authors, articles, global: globalData, about } = require('../data/data.json');

// Função principal para popular os dados de exemplo
async function seedExampleApp() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('Setting up the template...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
      // Re-lança o erro para que o processo de execução seja notificado da falha
      throw error; 
    }
  } else {
    console.log(
      'Seed data has already been imported. We cannot reimport unless you clear your database first.'
    );
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

async function setPublicPermissions(newPermissions) {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  let publicRole = null;
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 2000; // 2 segundos

  // Tenta encontrar o papel público várias vezes, pois ele pode não estar disponível imediatamente após o Strapi iniciar
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

  // Obtenha as permissões atuais do papel público
  // Note: A forma correta de atualizar permissões é um pouco mais complexa do que apenas criar novas entradas.
  // Você precisa buscar as permissões existentes e habilitá-las ou criá-las se não existirem.
  // A versão original do seu script (primeira que você me enviou) tinha uma abordagem melhor para isso.
  // Vou usar a lógica da sua primeira versão, que iterava sobre as permissões existentes.
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
          role: roleId // Adiciona o roleId para a nova permissão
        });
      }
    }
  }

  // Salva as permissões atualizadas no armazenamento do plugin
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

// Cria uma nova entrada no Strapi para um modelo específico
async function createEntry({ model, entry }) {
  try {
    // Usar strapi.entityService.create para criação de entradas
    await strapi.entityService.create(`api::${model}.${model}`, {
      data: entry,
    });
    console.log(`Created entry for model ${model}`);
  } catch (error) {
    console.error(`Error creating entry for model ${model}:`, error);
    throw error; // Re-lança o erro para que a seed script falhe se a criação de uma entrada falhar
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
        category: categoryId, // Certifique-se de que o ID da categoria está sendo passado corretamente
        author: authorId,   // Certifique-se de que o ID do autor está sendo passado corretamente
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
      ...globalData, // Use globalData aqui
      favicon,
      publishedAt: Date.now(),
      defaultSeo: {
        ...globalData.defaultSeo, // Use globalData aqui
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

async function importCategories() {
  for (const category of categories) {
    await createEntry({ model: 'category', entry: category });
  }
  console.log('Categories imported.');
}

async function importAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);

    await createEntry({
      model: 'author',
      entry: {
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

// Exporta a função principal para ser executada pelo Strapi CLI
// Quando o Strapi executa um script desta forma, ele já injeta o objeto 'strapi' globalmente.
module.exports = async () => {
  await seedExampleApp();
};