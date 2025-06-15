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

async function setPublicPermissions(newPermissions) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').createOrUpdate({
        where: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
          enabled: true,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
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

async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        publishedAt: Date.now(),
        blocks: updatedBlocks,
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

async function main() {
  if (typeof strapi !== 'undefined' && strapi.is && strapi.is.bootstrapped) {
    console.log('Executing seed script within existing Strapi instance context...');
    await seedExampleApp();
  } else {
    console.log('Strapi instance not found, attempting to start one for seeding (local dev mode)...');
    const setupStrapi = require('@strapi/strapi');
    const app = await setupStrapi({ appDir: process.cwd(), distDir: process.cwd() }).load();
    app.log.level = 'warn';
    await seedExampleApp();
    await app.destroy();
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Seed script encountered an error:', error);
  process.exit(1);
});
