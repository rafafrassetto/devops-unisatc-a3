# Usa uma imagem base oficial do Node.js.
# Escolhemos a versão 18 (LTS) e a variante 'alpine' para uma imagem menor e mais eficiente.
FROM node:18-alpine

# Define o diretório de trabalho dentro do contêiner.
# Todos os comandos subsequentes serão executados neste diretório.
WORKDIR /app

# Copia os arquivos package.json e package-lock.json.
# Isso é feito separadamente para aproveitar o cache de camadas do Docker.
COPY package.json ./
COPY package-lock.json ./

# Instala as dependências.
# Usamos '--production' para instalar apenas as dependências necessárias para a execução em produção.
RUN npm install --production

# Copia o restante do código da aplicação para o diretório de trabalho.
# O arquivo .dockerignore (no passo 2 abaixo) é CRÍTICO para garantir que
# arquivos desnecessários (como os testes Playwright) não sejam copiados.
COPY . .

# Garante que o diretório .tmp/db existe e tem as permissões corretas para o SQLite.
# O usuário 'node' é o usuário padrão da imagem node:alpine e será usado para executar a aplicação.
RUN mkdir -p ./.tmp/db && chmod -R 775 ./.tmp && chown -R node:node /app

# Constrói o painel de administração do Strapi para produção.
# Este passo é CRÍTICO para criar o diretório 'dist' que o Strapi precisa para iniciar.
# A condição 'if [ -d "./admin" ]' foi REMOVIDA.
RUN npm run build

# Expõe a porta padrão do Strapi.
# Por padrão, o Strapi roda na porta 1337.
EXPOSE 1337

# Define o comando que será executado quando o contêiner for iniciado.
# Este comando inicia a aplicação Strapi em modo de produção.
CMD ["npm", "start"]
