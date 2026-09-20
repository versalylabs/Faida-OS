import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { SEED_DB_BASE64 } from "./db-seed";

// Auto-seed /tmp SQLite database on Vercel or serverless cloud environments
function ensureDatabaseFile() {
  // If running on Vercel without a custom database, default safely to writable /tmp
  if (process.env.VERCEL === "1" && (!process.env.DATABASE_URL || process.env.DATABASE_URL === "file:./faida.db")) {
    process.env.DATABASE_URL = "file:/tmp/faida.db";
  }

  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/tmp/") || dbUrl.startsWith("file:/tmp/")) {
    const tmpMatch = dbUrl.replace(/^file:/, "");
    if (!fs.existsSync(tmpMatch)) {
      try {
        const dir = path.dirname(tmpMatch);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        // Write the bundled base64 SQLite seed database directly into /tmp
        fs.writeFileSync(tmpMatch, Buffer.from(SEED_DB_BASE64, "base64"));
        console.log(`[Faida DB] Successfully wrote bundled database to ${tmpMatch}`);
      } catch (e) {
        console.error(`[Faida DB] Error writing database to ${tmpMatch}:`, e);
      }
    }
  }
}

ensureDatabaseFile();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
