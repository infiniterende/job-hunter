export const APPLICATION_STATUSES = [
  "saved", "applied", "phone_screen", "interviewing", "offer", "rejected", "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isStatus(s: unknown): s is ApplicationStatus {
  return typeof s === "string" && (APPLICATION_STATUSES as readonly string[]).includes(s);
}

/** Format a Prisma @db.Date (UTC midnight Date) as YYYY-MM-DD. */
export const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
/** Parse a YYYY-MM-DD string into the UTC-midnight Date Prisma expects for @db.Date. */
export const fromYmd = (s: string) => new Date(`${s}T00:00:00Z`);

export type Job = {
  id: number;
  rank: number | null;
  source: string;
  company: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  is_nyc: boolean;
  url: string;
  posted_at: string | null;
  first_seen_at: string;
  score: number;
  score_breakdown: Record<string, number>;
  tags: string[];
  application_status: ApplicationStatus | null;
  applied_at: string | null;
};

export type Application = {
  id: number;
  job_id: number;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  updated_at: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  posted_at: string | null;
};
