"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Application, ApplicationStatus } from "@/lib/db";
import { Nav, STATUSES, STATUS_COLOR, STATUS_LABEL, Toast, fmtDate } from "@/components/ui";

const ACTIVE: ApplicationStatus[] = ["applied", "phone_screen", "interviewing", "offer"];

export default function AppliedPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | ApplicationStatus>("all");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/applications").then((r) => r.json()).then((a) => {
      setApps(a.applications);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  async function patchApp(a: Application, patch: Partial<Pick<Application, "status" | "applied_at" | "notes">>) {
    setApps((as) => as.map((x) => x.id === a.id ? { ...x, ...patch } : x));
    const res = await fetch(`/api/applications/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { flash("Could not save"); load(); return; }
    flash("Saved");
  }

  async function removeApp(a: Application) {
    if (!confirm(`Remove ${a.company} – ${a.title} from applied jobs?`)) return;
    await fetch(`/api/applications/${a.id}`, { method: "DELETE" });
    setApps((as) => as.filter((x) => x.id !== a.id));
    flash("Removed");
  }

  const visible = apps.filter((a) =>
    filter === "all" ? true : filter === "active" ? ACTIVE.includes(a.status) : a.status === filter);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, apps.filter((a) => a.status === s).length])) as Record<ApplicationStatus, number>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Applied jobs</h1>
          <p className="text-sm text-zinc-500">
            Every job you have marked from the daily picks. Edit status, date applied and notes inline.
          </p>
        </div>
        <Nav appliedCount={apps.length} />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {([["all", `All (${apps.length})`], ["active", `Active (${ACTIVE.reduce((n, s) => n + counts[s], 0)})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 ${filter === k ? "bg-zinc-900 text-white" : "bg-zinc-100 hover:bg-zinc-200"}`}>{label}</button>
        ))}
        <span className="mx-1 text-zinc-300">|</span>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 ${filter === s ? "ring-2 ring-zinc-900" : ""} ${STATUS_COLOR[s]}`}>
            {STATUS_LABEL[s]} {counts[s]}
          </button>
        ))}
      </div>

      {!loading && apps.length === 0 && (
        <p className="rounded border border-dashed p-6 text-sm text-zinc-500">
          Nothing tracked yet. Use the Status column on the <Link href="/" className="underline">daily picks</Link> to mark a job.
        </p>
      )}

      {visible.length > 0 && (
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
              {visible.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 font-medium">{a.company}</td>
                  <td className="px-3 py-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-zinc-600" title={a.location ?? ""}>{a.location || "—"}</td>
                  <td className="px-3 py-2">
                    <select value={a.status} onChange={(e) => patchApp(a, { status: e.target.value as ApplicationStatus })}
                      className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" value={a.applied_at ?? ""}
                      onChange={(e) => patchApp(a, { applied_at: e.target.value || null })}
                      className="rounded border border-zinc-300 px-1 py-0.5 text-xs" />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600">{fmtDate(a.posted_at)}</td>
                  <td className="px-3 py-2">
                    <input type="text" defaultValue={a.notes ?? ""} placeholder="notes…"
                      onBlur={(e) => e.target.value !== (a.notes ?? "") && patchApp(a, { notes: e.target.value })}
                      className="w-44 rounded border border-zinc-300 px-1 py-0.5 text-xs" />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeApp(a)} className="text-xs text-zinc-400 hover:text-red-600">remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {visible.length === 0 && apps.length > 0 && (
        <p className="text-sm text-zinc-500">No applications with this status.</p>
      )}
      <Toast msg={toast} />
    </main>
  );
}
