# syntax=docker/dockerfile:1.6

# Base image with Node and pnpm
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- deps stage: install workspace deps using pnpm with only necessary files ---
FROM base AS deps
# Copy workspace manifests and source needed for dependency resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY services/users/package.json services/users/
RUN pnpm install --no-frozen-lockfile

# --- build stage ---
FROM base AS build
RUN apk add --no-cache openssl
WORKDIR /app
# Copy lock, node_modules and pnpm store from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /pnpm/store /pnpm/store
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
# Copy source
COPY tsconfig*.json ./
COPY packages ./packages
COPY services/users ./services/users
# Build shared packages first, then service
RUN pnpm -r --filter=./packages/** build \
  && pnpm -C services/users prisma:generate \
  && pnpm -C services/users build

# --- runtime stage ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy needed files
COPY --from=build /app/services/users/dist ./services/users/dist
COPY --from=build /app/services/users/prisma ./services/users/prisma
COPY --from=build /app/services/users/package.json ./services/users/package.json
COPY --from=build /app/services/users/node_modules ./services/users/node_modules
COPY --from=build /app/node_modules ./node_modules
# Include workspace packages (built dist) for PNPM symlinked deps
COPY --from=build /app/packages ./packages

# Expose port
EXPOSE 4001

# Start command (migrations run via docker-compose command)
CMD ["node", "services/users/dist/services/users/src/main.js"]
