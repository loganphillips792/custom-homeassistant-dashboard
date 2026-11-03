FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY shared/package.json shared/
COPY web/package.json web/
COPY widgets/package.json widgets/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Installed on the same base as the build, so better-sqlite3's native binary matches.
FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter @dashboard/server...
COPY server/src server/src
COPY shared/src shared/src
COPY --from=build /app/web/dist web/dist
RUN mkdir /data && chown node:node /data
ENV DB_PATH=/data/dashboard.db PORT=3000
VOLUME /data
USER node
EXPOSE 3000
# From server/, because Node resolves the tsx import from the working directory.
WORKDIR /app/server
CMD ["node", "--import", "tsx", "src/index.ts"]
