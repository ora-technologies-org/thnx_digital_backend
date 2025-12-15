
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install dependencies for Prisma, health checks, AND native module compilation
RUN apk add --no-cache openssl wget python3 make g++

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
COPY prisma ./prisma/

# Install production deps, skip husky, then rebuild bcrypt
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]