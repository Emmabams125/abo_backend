# Backend engineering notes

## PostGIS columns must be declared in schema.prisma as `Unsupported`, not omitted

`LocationPing.location` and `SafePlace.location` are `Unsupported("geography(Point, 4326)")`
fields, with a `@@index([location], type: Gist)`. The datasource block declares
`extensions = [postgis]` (requires `previewFeatures = ["postgresqlExtensions"]`
on the generator).

**Do not** omit these from schema.prisma and add them via a hand-written raw-SQL
migration "on the side" — we tried that first and it silently breaks: every
subsequent `prisma migrate dev` diffs schema.prisma against the database, sees
a column/index it doesn't know about, and generates a `DROP COLUMN`/`DROP INDEX`
to "fix" the drift. It applies cleanly and reports success, so the breakage is
invisible until Safe Place / SOS location queries start failing.

With the extension and columns properly declared, Prisma generates correct
`CREATE EXTENSION` / geography column / GIST index DDL itself, and reads/writes
still go through `location.repository.ts` via `$queryRaw`/`$executeRaw` since
Prisma Client can't materialize `Unsupported` fields directly.

## `prisma migrate dev` needs a real TTY once `extensions = [...]` is set

Once the datasource declares `extensions = [postgis]`, `migrate dev` requires
interactive confirmation and fails in non-interactive shells (CI, some remote
dev environments) with "environment is non-interactive". In those contexts,
generate the SQL instead and apply it without a shadow DB:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
```

To sanity-check for drift without a shadow database:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
# should print "-- This is an empty migration." if there's no drift
```

A normal developer machine with a real terminal can still just run
`npm run prisma:migrate` (`prisma migrate dev`) as usual.

## Local Postgres port conflict

Docker Compose maps Postgres to host port **55432**, not 5432 — this machine
already had a native (non-Docker) PostgreSQL server bound to both 5432 and
5433. If `DATABASE_URL` ever needs to change, check `docker compose ps` for the
actual mapped port first.
