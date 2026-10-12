import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromYmd, isStatus, ymd } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// PATCH { status?, applied_at?, notes? }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const body = await req.json();
  if (body.status !== undefined && !isStatus(body.status))
    return NextResponse.json({ error: "bad status" }, { status: 400 });

  const data: { status?: string; applied_at?: Date | null; notes?: string; updated_at: Date } = {
    updated_at: new Date(),
  };
  if (body.status !== undefined) data.status = body.status;
  if (body.applied_at !== undefined) data.applied_at = body.applied_at ? fromYmd(body.applied_at) : null;
  if (body.notes !== undefined) data.notes = body.notes;

  const { count } = await prisma.applications.updateMany({ where: { id }, data });
  if (!count) return NextResponse.json({ error: "not found" }, { status: 404 });
  const application = await prisma.applications.findUnique({ where: { id } });
  return NextResponse.json({
    application: application && { ...application, job_id: Number(application.job_id), applied_at: ymd(application.applied_at) },
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  await prisma.applications.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
