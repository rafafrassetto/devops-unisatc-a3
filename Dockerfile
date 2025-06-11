FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install --production

COPY . .

RUN if [ -d "./admin" ]; then npm run build; fi

EXPOSE 1337


CMD ["npm", "start"]
