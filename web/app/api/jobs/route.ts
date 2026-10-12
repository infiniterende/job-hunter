import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromYmd, ymd, type Job } from "@/lib/db";

// GET /api/jobs?day=YYYY-MM-DD -> that day's ranked picks (defaults to the latest day)
export async function GET(req: NextRequest) {
  const dayParam = req.nextUrl.searchParams.get("day");
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

  const jobs: Job[] = picks.map(({ rank, jobs: j }) => ({
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
  }));

  return NextResponse.json({ day: ymd(day), days: days.map((d) => ymd(d.day)), jobs });
}
