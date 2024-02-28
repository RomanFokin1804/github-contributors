FROM node:18

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

RUN npm ci && npm cache clean --force

COPY --chown=node:node . .

RUN npm run build

CMD [ "node", "dist/main.js" ]