FROM node:22-alpine

WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm ci

EXPOSE 8080

CMD ["npm", "run", "dev"]
