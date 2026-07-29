import { Prisma, QuizAttemptStatus, QuizIntegrityEventType } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/guards";
import { digestQuizClientIp, integrityDedupeKey, isPlausibleIntegrityTime } from "@/features/quiz/integrity";
import { prisma } from "@/lib/prisma";
import { hasTrustedMutationOrigin, readBoundedJson, resolveTrustedClientIp } from "@/lib/request-security";

const bodySchema = z.object({ attemptId: z.uuid(), type: z.enum([QuizIntegrityEventType.TAB_HIDDEN, QuizIntegrityEventType.WINDOW_BLUR, QuizIntegrityEventType.COPY, QuizIntegrityEventType.PASTE]), occurredAt: z.iso.datetime() });

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  const body = await readBoundedJson(request, 2_048);
  if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const user = await requireAuthenticatedUser();
  const occurredAt = new Date(parsed.data.occurredAt);
  if (!isPlausibleIntegrityTime(occurredAt)) return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: parsed.data.attemptId, userId: user.id, status: QuizAttemptStatus.IN_PROGRESS }, select: { id: true } });
  if (!attempt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const requestHeaders = await headers();
  const ip = resolveTrustedClientIp(requestHeaders) ?? "untrusted-direct";
  let digest: string;
  try { digest = digestQuizClientIp(ip); } catch { return NextResponse.json({ error: "server_configuration" }, { status: 503 }); }
  const previous = await prisma.quizIntegrityEvent.findFirst({ where: { attemptId: attempt.id, clientIpDigest: { not: null } }, orderBy: { occurredAt: "desc" }, select: { clientIpDigest: true } });
  const now = new Date();
  const rows: Prisma.QuizIntegrityEventCreateManyInput[] = [{ attemptId: attempt.id, type: parsed.data.type, dedupeKey: integrityDedupeKey(parsed.data.type, now), clientIpDigest: digest, detail: { source: "browser" }, occurredAt }];
  if (previous?.clientIpDigest && previous.clientIpDigest !== digest) rows.push({ attemptId: attempt.id, type: QuizIntegrityEventType.IP_CHANGED, dedupeKey: integrityDedupeKey(QuizIntegrityEventType.IP_CHANGED, now), clientIpDigest: digest, detail: { source: "server" }, occurredAt });
  await prisma.quizIntegrityEvent.createMany({ data: rows, skipDuplicates: true });
  return NextResponse.json({ success: true });
}
