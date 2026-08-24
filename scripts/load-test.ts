const TARGET = process.env.TARGET ?? "http://localhost:8080/api/auth/get-session";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 1000);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 30000);

type Result = { status: number; ok: boolean; error?: string };

async function main() {
  console.log(`Firing ${CONCURRENCY} concurrent requests to ${TARGET}`);
  console.log("Watch Grafana (http://localhost:3001) while this runs.");
  console.log("");

  const start = performance.now();
  const results: Result[] = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      try {
        const res = await fetch(TARGET, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { status: 0, ok: false, error: (e as Error).message };
      }
    }),
  );
  const elapsed = (performance.now() - start) / 1000;

  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );
  const okCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`Total time: ${elapsed.toFixed(2)}s`);
  console.log(`Success: ${okCount} | Failed: ${failed.length} | Throughput: ${(CONCURRENCY / elapsed).toFixed(0)} req/s`);
  console.log("Status breakdown:", counts);
  if (failed.length > 0) {
    const sample = failed.find((f) => f.error);
    console.log("Sample error:", sample?.error ?? "non-2xx response");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});