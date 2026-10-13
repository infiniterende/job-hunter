# Job Hunter — dashboard

Next.js 16 + React + Tailwind front end for the [Job Hunter](../README.md) project. It reads the Supabase Postgres database through Prisma 7.

## Run

```bash
cp ../.env.example .env   # fill in DATABASE_URL and DIRECT_URL
npm install               # also runs `prisma generate`
npm run dev               # http://localhost:3000
```

## Structure

| Path | Purpose |
|---|---|
| `app/page.tsx` | Daily Top 100 table; the Status column saves a job to Applied jobs |
| `app/healthcare/page.tsx` | Top 100 healthcare-tech roles, live from the `jobs` table (`/api/jobs?tag=Healthcare`) |
| `components/JobsTable.tsx` | Company-grouped ranked table with the status column, shared by `/` and `/healthcare` |
| `app/applied/page.tsx` | Applied jobs: status, date applied, date posted, notes, with status filters |
| `components/ui.tsx` | Shared nav, tags, status constants, toast |
| `app/api/jobs/route.ts` | `GET /api/jobs?day=YYYY-MM-DD` ranked picks for a day |
| `app/api/applications/route.ts` | `GET` list, `POST` create/update an application |
| `app/api/applications/[id]/route.ts` | `PATCH` status/date/notes, `DELETE` stop tracking |
| `lib/prisma.ts` | Prisma client over the `@prisma/adapter-pg` driver |
| `lib/db.ts` | Shared types and date helpers |
| `prisma/schema.prisma` | Introspected from the live database (`npm run db:pull`) |
| `prisma.config.ts` | Prisma 7 config; uses `DIRECT_URL` for CLI commands |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run db:pull` | Re-introspect the database and regenerate the Prisma client |
