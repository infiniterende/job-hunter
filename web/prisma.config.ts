import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Session-mode pooler: used by `prisma db pull` / `db push` / migrations.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder",
  },
});
