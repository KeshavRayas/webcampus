# syntax=docker/dockerfile:1
# WebCampus Web — Next.js 15 (App Router), run via `next start`
# Build context must be the repo ROOT (CI uses `-f apps/web/Dockerfile .`).

FROM oven/bun:1.2.5

# Skip postinstall downloads we do not want during image builds
ENV HUSKY=0 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Dummy DB env so the workspace postinstall `prisma generate` can resolve the
# schema datasource without connecting. NEXT_PUBLIC_* are baked into the build
# below and must be the PUBLIC urls (server IP) in production.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?connection_limit=20&pgbouncer=true" \
    DATABASE_UNPOOLED_URL="postgresql://build:build@localhost:5432/build"

# curl for the healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Public URLs — override at build time:
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://<IP>:8080 \
#                --build-arg NEXT_PUBLIC_FRONTEND_URL=http://<IP>:3000 ...
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL

WORKDIR /app

# Full repo (respects .dockerignore: node_modules, .next, data, .git excluded)
COPY . .

# Install all workspace packages (generates the Prisma client via postinstall)
RUN bun install --frozen-lockfile

# Build the Next.js app (bakes NEXT_PUBLIC_* into the client bundle)
RUN cd apps/web && bun run build

WORKDIR /app/apps/web
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:3000/ || exit 1

CMD ["bun", "x", "next", "start", "-p", "3000"]