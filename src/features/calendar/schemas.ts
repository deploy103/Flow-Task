import { CalendarEventType } from "@prisma/client";
import { z } from "zod";
import { parseKoreanLocalDateTime } from "@/features/assignment/schemas";

const localDateTime = z.string().trim().transform((value, context) => {
  const parsed = parseKoreanLocalDateTime(value);
  if (!parsed) {
    context.addIssue({ code: "custom", message: "존재하는 KST 날짜와 시간을 입력해 주세요." });
    return z.NEVER;
  }
  return parsed;
});

export const calendarEventSchema = z.object({
  organizationId: z.uuid(),
  eventId: z.uuid().optional(),
  type: z.enum(CalendarEventType),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  startsAt: localDateTime,
  endsAt: localDateTime,
}).superRefine((data, context) => {
  if (data.startsAt >= data.endsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "종료 시각은 시작 시각보다 늦어야 합니다." });
});

export const calendarEventReferenceSchema = z.object({ organizationId: z.uuid(), eventId: z.uuid() });
