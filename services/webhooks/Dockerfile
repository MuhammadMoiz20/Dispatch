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
COPY services/webhooks/package.json services/webhooks/
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
COPY services/webhooks ./services/webhooks
# Build shared packages first, ensure local deps are linked, then service
RUN pnpm -r --filter=./packages/** build \
  && pnpm -C services/webhooks install --silent \
  && pnpm -C services/webhooks prisma:generate \
  && pnpm -C services/webhooks build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=build /app/services/webhooks/dist ./services/webhooks/dist
COPY --from=build /app/services/webhooks/prisma ./services/webhooks/prisma
COPY --from=build /app/services/webhooks/package.json ./services/webhooks/package.json
COPY --from=build /app/services/webhooks/node_modules ./services/webhooks/node_modules
COPY --from=build /app/node_modules ./node_modules
# Include workspace packages (built dist) for PNPM symlinked deps
COPY --from=build /app/packages ./packages
EXPOSE 4003
CMD ["node", "services/webhooks/dist/main.js"]
