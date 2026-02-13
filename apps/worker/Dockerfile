FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /app

# Install workspace dependencies first for better layer caching.
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN npm ci

# Copy source and build worker (includes shared build via worker script).
COPY packages/shared packages/shared
COPY apps/worker apps/worker

RUN npm run build -w @oid/worker

ENV NODE_ENV=production

CMD ["npm", "run", "start", "-w", "@oid/worker"]
