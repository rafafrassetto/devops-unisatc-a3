FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install --production



COPY . .

RUN mkdir -p ./.tmp/db && chmod -R 775 ./.tmp && chown -R node:node /app
RUN npm run build

EXPOSE 1337


CMD ["npm", "start"]
