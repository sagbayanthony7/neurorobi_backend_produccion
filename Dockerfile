FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3001 4000 3002 3003 3004 3005

CMD ["npm", "run", "start:prod"]
