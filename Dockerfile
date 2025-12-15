FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

<<<<<<< Updated upstream
# Stage 2: Production
=======
>>>>>>> Stashed changes
FROM node:20-alpine AS production

WORKDIR /app

<<<<<<< Updated upstream
# Install dependencies for Prisma and health checks
RUN apk add --no-cache openssl wget
=======
RUN apk add --no-cache openssl wget python3 make g++
>>>>>>> Stashed changes

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
COPY prisma ./prisma/

<<<<<<< Updated upstream
# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts
=======
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt --build-from-source
>>>>>>> Stashed changes

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]