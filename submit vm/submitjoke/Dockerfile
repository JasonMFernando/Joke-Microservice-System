FROM node:alpine

WORKDIR  /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4200

CMD [ "node"  , "app.js"]