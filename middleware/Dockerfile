FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY server.js ./
COPY .env.example ./

ENV NODE_ENV=production
EXPOSE 3002

CMD ["node", "server.js"]
