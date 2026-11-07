import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Tune the connection string for a pooled serverless Postgres (Neon):
 *  - pgbouncer=true: required by Prisma when talking to a pooler
 *  - connect_timeout: a suspended Neon database can take several seconds to wake up; the
 *    default (5s) turns that into "Can't reach database server" errors
 *  - connection_limit: keep each serverless instance to a few connections
 * Anything already set in DATABASE_URL wins.
 */
function tunedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pooled = url.hostname.includes("-pooler");
    if (pooled && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "20");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    if (pooled && !url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
    return url.toString();
  } catch {
    return raw;
  }
}

const url = tunedDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
