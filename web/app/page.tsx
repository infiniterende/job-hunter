"use client";

import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/db";
import { Nav, fmtDate } from "@/components/ui";
import { JobsTable, groupByCompany } from "@/components/JobsTable";

export default function Home() {
  const [day, setDay] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedCount, setAppliedCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback((d?: string | null) => {
    return Promise.all([
      fetch(`/api/jobs${d ? `?day=${d}` : ""}`).then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
    ]).then(([j, a]) => {
      setDay(j.day); setDays(j.days); setJobs(j.jobs);
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
          <h1 className="text-2xl font-semibold">Job Hunter</h1>
          <p className="text-sm text-zinc-500">
            Mid-level to senior software engineer roles · NYC / Remote · healthcare tech, big tech, startups · refreshed daily at 8am
          </p>
        </div>
        <Nav appliedCount={appliedCount} />
      </header>

      <div className="mb-3 flex items-center gap-3 text-sm">
        <label className="text-zinc-500">Day</label>
        <select value={day ?? ""} onChange={(e) => { setLoading(true); load(e.target.value); }}
          className="rounded border border-zinc-300 bg-white px-2 py-1">
          {days.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
        <span className="text-zinc-400">{loading ? "loading…" : `${jobs.length} ranked jobs across ${companies} companies`}</span>
      </div>

      {!loading && jobs.length === 0 && (
        <p className="rounded border border-dashed p-6 text-sm text-zinc-500">
          No picks yet. Run <code className="rounded bg-zinc-100 px-1">python scraper/scraper.py</code> to fetch jobs.
        </p>
      )}

      {jobs.length > 0 && (
        <JobsTable jobs={jobs} onJobsChange={(f) => setJobs(f)} onApplied={() => setAppliedCount((c) => (c ?? 0) + 1)} />
      )}
    </main>
  );
}
