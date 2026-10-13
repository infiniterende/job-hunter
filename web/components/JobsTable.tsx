"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { ApplicationStatus, Job } from "@/lib/db";
import { STATUSES, STATUS_COLOR, STATUS_LABEL, Tag, Toast, daysAgo, fmtDate } from "@/components/ui";

const GROUP_TAGS = ["Healthcare", "Big tech", "Startup", "NYC", "Remote"];

/** Group jobs by company, companies ordered by their best-ranked job. */
export function groupByCompany(jobs: Job[]) {
  const groups: { company: string; jobs: Job[] }[] = [];
  for (const j of jobs) {
    const key = j.company.trim().toLowerCase();
    const g = groups.find((x) => x.company.trim().toLowerCase() === key);
    if (g) g.jobs.push(j); else groups.push({ company: j.company, jobs: [j] });
  }
  return groups;
}

type Props = {
  jobs: Job[];
  onJobsChange: (update: (jobs: Job[]) => Job[]) => void;
  /** Called after a job is newly added to Applied jobs (not on later status edits). */
  onApplied?: () => void;
};

/** Ranked, company-grouped jobs table with an inline status column that saves to Applied jobs. */
export function JobsTable({ jobs, onJobsChange, onApplied }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const groups = groupByCompany(jobs);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function setJobStatus(job: Job, status: ApplicationStatus) {
    const prev = job.application_status;
    onJobsChange((js) => js.map((j) => j.id === job.id ? { ...j, application_status: status } : j));
    const res = await fetch("/api/applications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: job.id, status }),
    });
    if (!res.ok) {
      onJobsChange((js) => js.map((j) => j.id === job.id ? { ...j, application_status: prev } : j));
      flash("Could not save status");
      return;
    }
    const { application } = await res.json();
    onJobsChange((js) => js.map((j) => j.id === job.id ? { ...j, applied_at: application.applied_at } : j));
    if (!prev) onApplied?.();
    flash(`${job.company} saved to Applied jobs as “${STATUS_LABEL[status]}”`);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Position</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Posted</th>
              <th className="px-3 py-2">Apply</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.company}>
                <tr className="border-t border-zinc-200 bg-zinc-50/80">
                  <td colSpan={9} className="px-3 py-1.5">
                    <span className="font-semibold">{g.company}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {g.jobs.length} {g.jobs.length === 1 ? "role" : "roles"} · best #{g.jobs[0].rank} · score {g.jobs[0].score}
                    </span>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {g.jobs[0].tags.filter((t) => GROUP_TAGS.includes(t)).map((t) => <Tag key={t} t={t} />)}
                    </span>
                  </td>
                </tr>
                {g.jobs.map((j) => (
                  <tr key={j.id} className={`border-t border-zinc-100 hover:bg-zinc-50 ${j.application_status ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-3 py-2 text-zinc-400">{j.rank}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{j.company}</td>
                    <td className="px-3 py-2">
                      <a href={j.url} target="_blank" rel="noreferrer" className="hover:underline">{j.title}</a>
                      <div className="text-[11px] text-zinc-400">{j.source}</div>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-zinc-600" title={j.location ?? ""}>{j.location || "—"}</td>
                    <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{j.tags.map((t) => <Tag key={t} t={t} />)}</div></td>
                    <td className="px-3 py-2 font-mono" title={JSON.stringify(j.score_breakdown)}>{j.score}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                      {fmtDate(j.posted_at)}<div className="text-[11px] text-zinc-400">{daysAgo(j.posted_at)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <a href={j.url} target="_blank" rel="noreferrer"
                        className="inline-block whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700">Apply ↗</a>
                    </td>
                    <td className="px-3 py-2">
                      <select value={j.application_status ?? ""}
                        onChange={(e) => e.target.value && setJobStatus(j, e.target.value as ApplicationStatus)}
                        className={`rounded border px-1 py-0.5 text-xs ${j.application_status ? `border-transparent font-medium ${STATUS_COLOR[j.application_status]}` : "border-zinc-300 bg-white"}`}>
                        <option value="">— mark —</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      {j.application_status && (
                        <div className="mt-1 text-[11px] text-zinc-400">
                          {j.applied_at ? `applied ${fmtDate(j.applied_at)} · ` : ""}
                          <Link href="/applied" className="underline">view</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Toast msg={toast} />
    </>
  );
}
