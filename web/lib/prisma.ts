import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function create() {
  // Transaction-mode pooler (Supabase :6543) is fine here: node-postgres does not
  // use named prepared statements, and Prisma 7 talks through this driver adapter.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5 });
  return new PrismaClient({ adapter });
}

export const prisma = global.__prisma ?? create();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
