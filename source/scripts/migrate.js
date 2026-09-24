// Applies any unapplied prisma/migrations/*/migration.sql to the SQLite DB in
// DATABASE_URL. No users are seeded: the first admin is created on /setup.
// Runs at every app start (installer/start.cmd) and during the installer build.
// ponytail: hand-rolled applier because the Prisma CLI is not shipped to the cafe laptop.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dir = [
  path.join(__dirname, "migrations"), // installed layout
  path.join(__dirname, "..", "prisma", "migrations"), // source layout
].find(fs.existsSync);

async function main() {
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const rows = await prisma.$queryRawUnsafe("SELECT name FROM _migrations");
  const done = new Set(rows.map((r) => r.name));

  const names = fs
    .readdirSync(dir)
    .filter((n) => fs.existsSync(path.join(dir, n, "migration.sql")))
    .sort();

  for (const name of names) {
    if (done.has(name)) continue;
    const sql = fs
      .readFileSync(path.join(dir, name, "migration.sql"), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    const stmts = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    await prisma.$transaction([
      ...stmts.map((s) => prisma.$executeRawUnsafe(s)),
      prisma.$executeRawUnsafe(
        "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
        name,
        new Date().toISOString()
      ),
    ]);
    console.log("migration applied:", name);
  }
}

main()
  .catch((e) => {
    console.error("migration failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
