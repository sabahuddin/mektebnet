import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// VAŽNO: drizzle-kit 0.31 ima bug kad mu se daju absolute path-evi za `out`
// (rezultat: prependuje `./` i pravi `.//abs/path` koji ne postoji). Zato
// koristimo isključivo relativne path-eve i očekujemo da se generate poziva
// sa CWD = lib/db (npm script "generate" radi to automatski jer pnpm filter
// postavlja CWD na package directory).
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
