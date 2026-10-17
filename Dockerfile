# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- build the SPA
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# -------------------------------------------------------------------- runtime
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3101
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# chown because local checkouts can carry 0600 modes, which the non-root user could not read
COPY --chown=node:node server ./server
COPY --from=build --chown=node:node /app/dist ./dist

# uid 1000, matching the usual homelab user; nothing in the app writes to disk
USER node
EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3101)+'/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
