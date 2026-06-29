# WebCampus Development

## Quick Start

```bash
bun install
sh scripts/env-setup.sh    # Copy .env templates
# Fill apps/api/.env with GMAIL_APP_PASSWORD and SENDER_EMAIL
bun run dev
```

## Key Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Starts all apps (web on localhost:3000, api server) |
| `bun run build` | Turborepo build |
| `bun run lint` | ESLint all packages |
| `bun run format:write` | Prettier format |
| `bun run check-types` | TypeScript checks |
| `bun dx` | Start Docker + Prisma generate (for db) |
| `bun run bootstrap` | Create admin user |

## Package Structure

- `apps/web` - Next.js 15 (App Router), React 19, port 3000
- `apps/api` - Express on Bun
- `packages/db` - Prisma 5, PostgreSQL via Docker
- `packages/ui` - Radix + Tailwind components
- `packages/auth` - better-auth

## Database

```bash
bun dx              # Start docker + prisma generate
bun run db:generate
bun run db:migrate
bun run db:studio  # Prisma GUI
```

Prisma schema in `packages/db/prisma/schema.prisma`.

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Turborepo
- **Web**: Next.js 15, React 19, Tailwind CSS 4
- **API**: Express + Bun
- **DB**: Prisma 5, PostgreSQL
- **Auth**: better-auth
- **Testing**: Playwright (e2e)

## Important Notes

- Uses **Bun** (not npm/yarn). All commands should use `bun run`
- Docker must be running for local dev
- GMAIL_APP_PASSWORD and SENDER_EMAIL required in `apps/api/.env` for email features
- Pre-commit uses husky + lint-staged (runs prettier + eslint)
- Apps/api uses Prisma Client v5, but db package specifies Prisma 5 in dependencies