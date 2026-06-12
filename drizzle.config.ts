import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Carga `.env` desde la raíz del proyecto. Lo lee SOLO el tooling de Node
// (drizzle-kit, tsx scripts). El Worker en runtime usa `.dev.vars` (vía wrangler)
// o Cloudflare secrets (prod). Ver AGENTS.md §10.
config({ path: ".env" });

export default defineConfig({
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
