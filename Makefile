scrape:        ## fetch + rank + save today's top picks to Supabase
	scraper/.venv/bin/python scraper/scraper.py run
check-boards:  ## verify which board tokens are live
	scraper/.venv/bin/python scraper/scraper.py check
web:           ## run the Next.js dashboard on http://localhost:3000
	cd web && npm run dev
db-pull:       ## re-introspect Supabase into prisma/schema.prisma after changing schema.sql
	cd web && npm run db:pull
db-shell:      ## psql into Supabase (session pooler)
	set -a; . ./.env; set +a; psql "$$DIRECT_URL"
