"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ApplicationStatus } from "@/lib/db";

export const STATUSES: ApplicationStatus[] = [
  "saved", "applied", "phone_screen", "interviewing", "offer", "rejected", "withdrawn",
];
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved", applied: "Applied", phone_screen: "Phone screen",
  interviewing: "Interviewing", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};
export const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: "bg-zinc-200 text-zinc-800", applied: "bg-blue-100 text-blue-800",
  phone_screen: "bg-violet-100 text-violet-800", interviewing: "bg-amber-100 text-amber-800",
  offer: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  // Date-only strings (YYYY-MM-DD) must not be shifted by the local timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function daysAgo(s: string | null) {
  if (!s) return "";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

const TAG_COLOR: Record<string, string> = {
  NYC: "bg-sky-100 text-sky-800",
  Remote: "bg-teal-100 text-teal-800",
  Senior: "bg-indigo-100 text-indigo-800",
  Mid: "bg-indigo-50 text-indigo-700",
  "Staff+": "bg-zinc-100 text-zinc-500",
  Healthcare: "bg-rose-100 text-rose-800",
  "Big tech": "bg-orange-100 text-orange-800",
  Startup: "bg-lime-100 text-lime-800",
  ai: "bg-fuchsia-100 text-fuchsia-800",
  react: "bg-cyan-100 text-cyan-800",
  python: "bg-yellow-100 text-yellow-800",
};
export function Tag({ t }: { t: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TAG_COLOR[t] ?? "bg-zinc-100 text-zinc-700"}`}>{t}</span>
  );
}

/** Top navigation shared by the picks page and the applied-jobs page. */
export function Nav({ appliedCount }: { appliedCount?: number }) {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href}
      className={`rounded-md px-3 py-1.5 ${path === href ? "bg-zinc-900 text-white" : "bg-zinc-100 hover:bg-zinc-200"}`}>
      {label}
    </Link>
  );
  return (
    <nav className="flex gap-2 text-sm">
      {link("/", "Daily picks")}
      {link("/healthcare", "Healthcare tech")}
      {link("/applied", `Applied jobs${appliedCount !== undefined ? ` (${appliedCount})` : ""}`)}
    </nav>
  );
}

/** Small transient confirmation banner. */
export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 right-6 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{msg}</div>
  );
}
