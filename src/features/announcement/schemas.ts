import { AnnouncementAudience, AnnouncementPriority } from "@prisma/client";
import { z } from "zod";

export const createAnnouncementSchema = z.object({
  organizationId: z.uuid(),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(100),
  content: z.string().trim().min(1, "내용을 입력해 주세요.").max(10_000),
  priority: z.enum([AnnouncementPriority.NORMAL, AnnouncementPriority.IMPORTANT]),
  audience: z.enum([AnnouncementAudience.ALL_MEMBERS, AnnouncementAudience.SELECTED_MEMBERS]),
});

export const announcementReferenceSchema = z.object({
  organizationId: z.uuid(),
  announcementId: z.uuid(),
});

export const recipientIdsSchema = z.array(z.uuid()).max(500);
