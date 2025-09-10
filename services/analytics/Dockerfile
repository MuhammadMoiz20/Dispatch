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
COPY services/analytics/package.json services/analytics/
RUN pnpm install --no-frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /pnpm/store /pnpm/store
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig*.json ./
COPY packages ./packages
COPY services/analytics ./services/analytics
# Build shared packages first, then service
RUN pnpm -r --filter=./packages/** build \
  && pnpm -C services/analytics install --silent \
  && pnpm -C services/analytics build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=build /app/services/analytics/dist ./services/analytics/dist
COPY --from=build /app/services/analytics/package.json ./services/analytics/package.json
COPY --from=build /app/services/analytics/node_modules ./services/analytics/node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
EXPOSE 4007
CMD ["node", "services/analytics/dist/main.js"]

