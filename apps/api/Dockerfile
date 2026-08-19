# syntax=docker/dockerfile:1
# WebCampus API — Express on Bun + Chromium (Puppeteer hall-ticket PDFs)
# Build context must be the repo ROOT (CI uses `-f apps/api/Dockerfile .`).

FROM oven/bun:1.2.5

# Skip postinstall downloads we do not want during image builds
ENV HUSKY=0 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Dummy DB env so the workspace postinstall `prisma generate` can resolve the
# schema datasource without connecting. Real values come from compose at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?connection_limit=20&pgbouncer=true" \
    DATABASE_UNPOOLED_URL="postgresql://build:build@localhost:5432/build"

# Chromium for Puppeteer + curl for the healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Full repo (respects .dockerignore: node_modules, .next, data, .git excluded)
COPY . .

# Install all workspace packages (generates the Prisma client via postinstall)
RUN bun install --frozen-lockfile

# Build the API bundle (tsup -> dist/)
RUN cd apps/api && bun run build

# The hall-ticket service reads the BMSCE logo at runtime. Dev resolves it via a
# source-tree-relative path that does not exist in the container, so we copy it
# to a fixed location and point at it via BMSCE_LOGO_PATH.
RUN mkdir -p /app && cp apps/web/public/bmsce.svg /app/bmsce.svg
ENV BMSCE_LOGO_PATH=/app/bmsce.svg \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/apps/api
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8080/api/auth/get-session || exit 1

CMD ["bun", "run", "dist/index.js"]