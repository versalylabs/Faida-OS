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

/**
 * Errors that come from the connection, not from the query: a database that is still waking up, a pooled
 * connection the server closed while the app was idle, a closed connection that was reused.
 * Running the same query again on a fresh connection almost always works.
 */
const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
function isTransient(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code && TRANSIENT_CODES.has(e.code)) return true;
  return /Server has closed the connection|ConnectionReset|forcibly closed|Connection terminated/i.test(e?.message || "");
}

const url = tunedDatabaseUrl(process.env.DATABASE_URL);

function createClient(): PrismaClient {
  const base = new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  // One quiet retry for connection hiccups (reads and writes alike: a failed connection never ran the query).
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!isTransient(err)) throw err;
          await new Promise((r) => setTimeout(r, 400));
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = prisma;
