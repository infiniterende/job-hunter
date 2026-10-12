"use client";

import { useCallback, useEffect, useState } from "react";
import type { Application, ApplicationStatus, Job } from "@/lib/db";

const STATUSES: ApplicationStatus[] = [
  "saved", "applied", "phone_screen", "interviewing", "offer", "rejected", "withdrawn",
];
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved", applied: "Applied", phone_screen: "Phone screen",
  interviewing: "Interviewing", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};
const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: "bg-zinc-200 text-zinc-800", applied: "bg-blue-100 text-blue-800",
  phone_screen: "bg-violet-100 text-violet-800", interviewing: "bg-amber-100 text-amber-800",
  offer: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  // Date-only strings (YYYY-MM-DD) must not be shifted by the local timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysAgo(s: string | null) {
  if (!s) return "";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

function Tag({ t }: { t: string }) {
  const c =
    t === "NYC" ? "bg-sky-100 text-sky-800" :
    t === "Remote" ? "bg-teal-100 text-teal-800" :
    t === "ai" ? "bg-fuchsia-100 text-fuchsia-800" :
    t === "react" ? "bg-cyan-100 text-cyan-800" :
    t === "python" ? "bg-yellow-100 text-yellow-800" : "bg-zinc-100 text-zinc-700";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c}`}>{t}</span>;
}

export default function Home() {
  const [day, setDay] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"picks" | "applications">("picks");

  const load = useCallback((d?: string | null) => {
    return Promise.all([
      fetch(`/api/jobs${d ? `?day=${d}` : ""}`).then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
    ]).then(([j, a]) => {
      setDay(j.day); setDays(j.days); setJobs(j.jobs); setApps(a.applications);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setJobStatus(jobId: number, status: ApplicationStatus) {
    await fetch("/api/applications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status }),
    });
    load(day);
  }
  async function patchApp(id: number, patch: Partial<Application>) {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load(day);
  }
  async function removeApp(id: number) {
    if (!confirm("Remove this application from tracking?")) return;
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    load(day);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job Hunter</h1>
          <p className="text-sm text-zinc-500">
            Software engineer roles · NYC / Remote · ranked by React, Python, AI · refreshed daily at 8am
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setTab("picks")}
            className={`rounded-md px-3 py-1.5 ${tab === "picks" ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>
            Daily top {jobs.length || 25}
          </button>
          <button onClick={() => setTab("applications")}
            className={`rounded-md px-3 py-1.5 ${tab === "applications" ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>
            My applications ({apps.length})
          </button>
        </div>
      </header>

      {tab === "picks" && (
        <section>
          <div className="mb-3 flex items-center gap-3 text-sm">
            <label className="text-zinc-500">Day</label>
            <select value={day ?? ""} onChange={(e) => { setLoading(true); load(e.target.value); }}
              className="rounded border border-zinc-300 bg-white px-2 py-1">
              {days.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
            {loading && <span className="text-zinc-400">loading…</span>}
          </div>
          {!loading && jobs.length === 0 && (
            <p className="rounded border border-dashed p-6 text-sm text-zinc-500">
              No picks yet. Run <code className="rounded bg-zinc-100 px-1">python scraper/scraper.py</code> to fetch jobs.
            </p>
          )}
          {jobs.length > 0 && (
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
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-400">{j.rank}</td>
                      <td className="px-3 py-2 font-medium">{j.company}</td>
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
                          onChange={(e) => e.target.value && setJobStatus(j.id, e.target.value as ApplicationStatus)}
                          className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs">
                          <option value="">— mark —</option>
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "applications" && (
        <section>
          {apps.length === 0 && (
            <p className="rounded border border-dashed p-6 text-sm text-zinc-500">
              Nothing tracked yet. Use the Status column on the daily picks to mark a job as applied.
            </p>
          )}
          {apps.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Date applied</th>
                    <th className="px-3 py-2">Date posted</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium">{a.company}</td>
                      <td className="px-3 py-2"><a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a></td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-zinc-600">{a.location || "—"}</td>
                      <td className="px-3 py-2">
                        <select value={a.status} onChange={(e) => patchApp(a.id, { status: e.target.value as ApplicationStatus })}
                          className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" value={a.applied_at?.slice(0, 10) ?? ""}
                          onChange={(e) => patchApp(a.id, { applied_at: e.target.value })}
                          className="rounded border border-zinc-300 px-1 py-0.5 text-xs" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-600">{fmtDate(a.posted_at)}</td>
                      <td className="px-3 py-2">
                        <input type="text" defaultValue={a.notes ?? ""} placeholder="notes…"
                          onBlur={(e) => e.target.value !== (a.notes ?? "") && patchApp(a.id, { notes: e.target.value })}
                          className="w-40 rounded border border-zinc-300 px-1 py-0.5 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeApp(a.id)} className="text-xs text-zinc-400 hover:text-red-600">remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
