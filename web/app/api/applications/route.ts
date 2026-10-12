import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromYmd, isStatus, ymd, type Application } from "@/lib/db";

export async function GET() {
  const rows = await prisma.applications.findMany({
    include: { jobs: true },
    orderBy: [{ applied_at: { sort: "desc", nulls: "last" } }, { updated_at: "desc" }],
  });
  const applications: Application[] = rows.map((a) => ({
    id: a.id,
    job_id: Number(a.job_id),
    status: a.status as Application["status"],
    applied_at: ymd(a.applied_at),
    notes: a.notes,
    updated_at: a.updated_at.toISOString(),
    company: a.jobs.company,
    title: a.jobs.title,
    location: a.jobs.location,
    url: a.jobs.url,
    posted_at: a.jobs.posted_at?.toISOString() ?? null,
  }));
  return NextResponse.json({ applications });
}

// POST { job_id, status?, applied_at?, notes? } -> create or update the application for a job
export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobId = Number(body.job_id);
  const status = body.status ?? "applied";
  if (!Number.isInteger(jobId)) return NextResponse.json({ error: "job_id required" }, { status: 400 });
  if (!isStatus(status)) return NextResponse.json({ error: "bad status" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const appliedAt: Date | null =
    body.applied_at ? fromYmd(body.applied_at) : status === "saved" ? null : fromYmd(today);
  const notes: string | undefined = body.notes ?? undefined;

  const application = await prisma.applications.upsert({
    where: { job_id: BigInt(jobId) },
    create: { job_id: BigInt(jobId), status, applied_at: appliedAt, notes },
    update: { status, applied_at: appliedAt ?? undefined, notes, updated_at: new Date() },
  });
  return NextResponse.json({
    application: { ...application, job_id: Number(application.job_id), applied_at: ymd(application.applied_at) },
  });
}
