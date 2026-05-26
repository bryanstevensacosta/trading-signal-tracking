# Build stage: compile TypeScript
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts

COPY . .
RUN npm rebuild better-sqlite3
RUN npm run build

# Production stage: minimal runtime
FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 && \
    mkdir -p /app/data /app/logs && \
    chown -R nestjs:nodejs /app

COPY --from=builder --chown=nestjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts --ignore-optional && npm cache clean --force

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

USER nestjs

CMD ["node", "dist/main.js"]