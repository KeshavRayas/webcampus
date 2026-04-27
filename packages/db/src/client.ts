import { PrismaClient } from "../generated/prisma";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const logOptions =
  process.env.NODE_ENV !== "production"
    ? (["query", "error", "warn"] as const)
    : (["error", "warn"] as const);

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: logOptions.map((level) => ({ emit: "event", level })),
  });

if (process.env.NODE_ENV !== "production") {
  (
    db as unknown as {
      $on: (
        event: "query",
        handler: (e: {
          query: string;
          params: string;
          duration: number;
        }) => void
      ) => void;
    }
  ).$on("query", (e) => {
    console.log("[Prisma Query]", {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
