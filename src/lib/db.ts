import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

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
      const candidates = [
        path.join(process.cwd(), "prisma", "faida.db"),
        path.join(__dirname, "..", "..", "prisma", "faida.db"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            const dir = path.dirname(tmpMatch);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.copyFileSync(candidate, tmpMatch);
            console.log(`[Faida DB] Successfully copied seed database to ${tmpMatch}`);
            break;
          } catch (e) {
            console.error(`[Faida DB] Error copying database:`, e);
          }
        }
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
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
