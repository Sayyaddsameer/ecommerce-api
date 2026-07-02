FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm install --no-save jest supertest

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]
