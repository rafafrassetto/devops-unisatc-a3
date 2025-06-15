FROM node:18-alpine
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install --production

COPY . .

RUN mkdir -p ./.tmp/db && chmod -R 775 ./.tmp && chown -R node:node /app

RUN npm run build
RUN APP_KEYS="dummyKeyForBuild,anotherDummyKey" /usr/bin/env node ./scripts/seed.js || true

EXPOSE 1337

CMD ["npm", "run", "start:ci"]