// Daily cron job (see deploy/README in setup notes): runs one trivial query so
// the free-tier Supabase project is never seen as idle and auto-paused.
// Remove once the project is on Supabase Pro, which never pauses.
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
prisma
  .$queryRaw`SELECT 1`
  .then(() => console.log(new Date().toISOString(), "keepalive ok"))
  .catch((err) => {
    console.error(new Date().toISOString(), "keepalive failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
