import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromYmd, ymd, type Job } from "@/lib/db";

type JobRow = Awaited<ReturnType<typeof prisma.jobs.findMany<{ include: { applications: true } }>>>[number];

function toJob(j: JobRow, rank: number | null): Job {
  return {
    id: Number(j.id),
    rank,
    source: j.source,
    company: j.company,
    title: j.title,
    location: j.location,
    is_remote: j.is_remote,
    is_nyc: j.is_nyc,
    url: j.url,
    posted_at: j.posted_at?.toISOString() ?? null,
    first_seen_at: j.first_seen_at.toISOString(),
    score: j.score,
    score_breakdown: (j.score_breakdown ?? {}) as Record<string, number>,
    tags: j.tags,
    application_status: (j.applications?.status as Job["application_status"]) ?? null,
    applied_at: ymd(j.applications?.applied_at),
  };
}

const MAX_AGE_DAYS = Number(process.env.MAX_AGE_DAYS ?? 30);

// GET /api/jobs?day=YYYY-MM-DD        -> that day's ranked picks (defaults to the latest day)
// GET /api/jobs?tag=Healthcare&limit=100 -> live top-N jobs carrying a tag, ranked by score
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const tag = q.get("tag");
  if (tag) {
    const limit = Math.min(Number(q.get("limit") ?? 100) || 100, 500);
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400000);
    const recentlySeen = new Date(Date.now() - 36 * 3600000);
    const rows = await prisma.jobs.findMany({
      where: { tags: { has: tag }, posted_at: { gte: cutoff }, last_seen_at: { gte: recentlySeen } },
      orderBy: [{ score: "desc" }, { posted_at: "desc" }, { id: "asc" }],
      take: limit,
      include: { applications: true },
    });
    return NextResponse.json({ tag, jobs: rows.map((j, i) => toJob(j, i + 1)) });
  }

  const dayParam = q.get("day");
  const day = dayParam
    ? fromYmd(dayParam)
    : (await prisma.daily_picks.aggregate({ _max: { day: true } }))._max.day;
  if (!day) return NextResponse.json({ day: null, days: [], jobs: [] });

  const [picks, days] = await Promise.all([
    prisma.daily_picks.findMany({
      where: { day },
      orderBy: { rank: "asc" },
      include: { jobs: { include: { applications: true } } },
    }),
    prisma.daily_picks.findMany({
      distinct: ["day"], select: { day: true }, orderBy: { day: "desc" }, take: 30,
    }),
  ]);

  return NextResponse.json({
    day: ymd(day),
    days: days.map((d) => ymd(d.day)),
    jobs: picks.map(({ rank, jobs: j }) => toJob(j, rank)),
  });
}
