# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY services/rules/package.json services/rules/
RUN pnpm install --no-frozen-lockfile

FROM base AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /pnpm/store /pnpm/store
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig*.json ./
COPY packages ./packages
COPY services/rules ./services/rules
# Build shared packages first (if any), then service
RUN pnpm -r --filter=./packages/** build \
  && pnpm -C services/rules install --silent \
  && pnpm -C services/rules prisma:generate \
  && pnpm -C services/rules build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=build /app/services/rules/dist ./services/rules/dist
COPY --from=build /app/services/rules/prisma ./services/rules/prisma
COPY --from=build /app/services/rules/package.json ./services/rules/package.json
COPY --from=build /app/services/rules/node_modules ./services/rules/node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
EXPOSE 4004
CMD ["node", "services/rules/dist/main.js"]
