# Job Hunter

[github.com/infiniterende/job-hunter](https://github.com/infiniterende/job-hunter)

Daily ranked software-engineer job feed built from the public **Greenhouse**, **Ashby** and **Lever** job-board APIs.

- **Scraper** (`scraper/`, Python): fetches every board in `scraper/companies.json`, keeps software-engineering roles posted in the last 30 days that are **NYC-based or US-remote**, scores them on NYC / Remote / Senior / **React** / **Python** / **AI**, deduplicates by source + job id, upserts into Postgres and snapshots the **top 25** for the day.
- **Database**: Supabase Postgres. Schema in `schema.sql` (`jobs`, `daily_picks`, `applications`, `companies`). The Next.js app reads it through **Prisma 7** (`web/prisma/schema.prisma`, introspected from the live database, with the `@prisma/adapter-pg` driver).
- **Dashboard** (`web/`, Next.js + React + Tailwind): the day's top 25 with direct application links, plus an application tracker (status, date applied, date posted, notes).
- **Cron**: GitHub Actions runs the scraper every day at **8:00am New York time** (`.github/workflows/daily-scrape.yml`).

## How it works

```
Greenhouse / Ashby / Lever APIs
          │  scraper/scraper.py  (GitHub Actions, daily 8am ET)
          ▼
  filter: SWE title · posted ≤ 30 days · NYC or US-remote
  score : NYC · Remote · Senior · React · Python · AI · freshness
          ▼
   Supabase Postgres  ──  jobs · daily_picks · applications
          │  Prisma
          ▼
   Next.js dashboard  ──  Daily Top 25 · My Applications
```

## Repository layout

| Path | Purpose |
|---|---|
| `scraper/scraper.py` | Fetch, filter, score, upsert, prune, snapshot daily picks |
| `scraper/companies.json` | Board tokens to scrape (verified live with `make check-boards`) |
| `schema.sql` | Postgres schema, idempotent |
| `web/` | Next.js dashboard and API ([its README](web/README.md)) |
| `.github/workflows/daily-scrape.yml` | 8am New York time cron |
| `Makefile` | `make scrape`, `make web`, `make check-boards`, `make db-pull`, `make db-shell` |

## Setup

1. Copy `.env.example` to `.env` (repo root) and `web/.env`, filling in your Supabase pooler URLs:
   - `DIRECT_URL`: session-mode pooler, port 5432 (scraper, Prisma `db pull` / `db push`)
   - `DATABASE_URL`: transaction-mode pooler, port 6543 with `?pgbouncer=true` (Next.js runtime)
2. Create the tables once: `psql "$DIRECT_URL" -f schema.sql`
3. Scraper: `python3 -m venv scraper/.venv && scraper/.venv/bin/pip install -r scraper/requirements.txt`
4. Web: `cd web && npm install` (this also runs `prisma generate`)

```bash
make scrape   # fetch + rank + write today's picks (~1 min)
make web      # dashboard on http://localhost:3000
```

## Daily 8am run (GitHub Actions)

Push this repo to GitHub and add one repository secret under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `DIRECT_URL` | the Supabase session-mode pooler URL (port 5432) |

The workflow fires at 8:00am America/New_York every day. Both 12:00 and 13:00 UTC are scheduled and a gate step picks the one that is 8am locally, so it survives DST changes. Use *Actions → Daily job scrape → Run workflow* to trigger it by hand.

## Changing the schema

Edit `schema.sql`, apply it to Supabase with `psql "$DIRECT_URL" -f schema.sql`, then re-introspect so Prisma stays in sync:

```bash
make db-pull
```

## Ranking

| Signal | Points |
|---|---|
| NYC location | 30 |
| Remote (US) | 25 (10 if also NYC) |
| Software-engineering title | 20 |
| Senior / Staff / Principal / Lead | 10 |
| React / Next.js / TypeScript | 15 (+10 if in title) |
| Python / Django / FastAPI / Flask | 15 (+10 if in title) |
| AI / ML / LLM / GenAI | 15 (+10 if in title) |
| Freshness | 0–10, decays over 30 days |

Tune the regexes and weights at the top of `scraper/scraper.py`. Jobs you have already marked in the tracker are excluded from future daily picks.

## Adding companies

Add the board token (the slug in `boards.greenhouse.io/<token>`, `jobs.ashbyhq.com/<token>` or `jobs.lever.co/<token>`) to `scraper/companies.json`, then verify with:

```bash
make check-boards
```

## API

| Route | Description |
|---|---|
| `GET /api/jobs?day=YYYY-MM-DD` | Ranked picks for a day (defaults to latest) |
| `GET /api/applications` | Tracked applications |
| `POST /api/applications` | `{ job_id, status?, applied_at?, notes? }` create/update |
| `PATCH /api/applications/:id` | Update status / applied_at / notes |
| `DELETE /api/applications/:id` | Stop tracking |
