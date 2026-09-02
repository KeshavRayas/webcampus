import { PrismaClient } from "../packages/db/generated/prisma/index.js";

const POOLED_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:example@localhost:6543/webcampus?connection_limit=20&pgbouncer=true";
const UNPOOLED_URL =
  process.env.DATABASE_UNPOOLED_URL ??
  "postgresql://postgres:example@localhost:5432/webcampus";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const SLEEP_SECONDS = Number(process.env.SLEEP_SECONDS ?? 1);

const pooled = new PrismaClient({ datasources: { db: { url: POOLED_URL } } });
const unpooled = new PrismaClient({ datasources: { db: { url: UNPOOLED_URL } } });

async function backendConnections(): Promise<number> {
  const rows = await unpooled.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND client_addr IS NOT NULL`;
  return Number(rows[0].count);
}

async function main() {
  console.log("--- PgBouncer bottleneck test ---");
  console.log(`Pooled URL:   ${POOLED_URL.replace(/\/\/.*@/, "//***@")}`);
  console.log(`Unpooled URL: ${UNPOOLED_URL.replace(/\/\/.*@/, "//***@")}`);
  console.log(`Concurrency:  ${CONCURRENCY} queries of SELECT pg_sleep(${SLEEP_SECONDS})`);
  console.log("Watch Grafana (http://localhost:3001) while this runs.");
  console.log("");

  const queries = Array.from({ length: CONCURRENCY }, () =>
    pooled.$queryRaw`SELECT pg_sleep(${SLEEP_SECONDS})::text AS result`,
  );

  const start = performance.now();
  const running = Promise.all(queries);
  await new Promise((r) => setTimeout(r, 200));
  const connsDuring = await backendConnections();
  await running;
  const elapsed = (performance.now() - start) / 1000;

  console.log(`Total wall-clock: ${elapsed.toFixed(2)}s for ${CONCURRENCY} concurrent queries`);
  console.log(`Backend connections to Postgres DURING burst: ${connsDuring}`);
  if (CONCURRENCY > 1 && connsDuring < CONCURRENCY) {
    console.log(
      `=> Pooling working: ${CONCURRENCY} clients multiplexed through only ${connsDuring} Postgres connection(s).`,
    );
  }

  await pooled.$disconnect();
  await unpooled.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await pooled.$disconnect();
  await unpooled.$disconnect();
  process.exit(1);
});