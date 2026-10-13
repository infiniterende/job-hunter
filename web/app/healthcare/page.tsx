"use client";

import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/db";
import { Nav } from "@/components/ui";
import { JobsTable, groupByCompany } from "@/components/JobsTable";

export default function HealthcarePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedCount, setAppliedCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/jobs?tag=Healthcare&limit=100").then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
    ]).then(([j, a]) => {
      setJobs(j.jobs);
      setAppliedCount(a.applications.length);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const companies = groupByCompany(jobs).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Healthcare tech</h1>
          <p className="text-sm text-zinc-500">
            Top 100 software engineer roles at healthcare-tech companies · NYC / Remote · posted in the last 30 days · ranked by score, grouped by company
          </p>
        </div>
        <Nav appliedCount={appliedCount} />
      </header>

      <div className="mb-3 text-sm text-zinc-400">
        {loading ? "loading…" : `${jobs.length} roles across ${companies} companies`}
      </div>

      {!loading && jobs.length === 0 && (
        <p className="rounded border border-dashed p-6 text-sm text-zinc-500">
          No healthcare roles found. Make sure healthcare companies are listed under <code className="rounded bg-zinc-100 px-1">categories.healthcare</code> in scraper/companies.json and run the scraper.
        </p>
      )}

      {jobs.length > 0 && (
        <JobsTable jobs={jobs} onJobsChange={(f) => setJobs(f)} onApplied={() => setAppliedCount((c) => (c ?? 0) + 1)} />
      )}
    </main>
  );
}
