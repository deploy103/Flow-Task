import { AnnouncementAudience, AnnouncementPriority } from "@prisma/client";
import { z } from "zod";
import {
  MAX_ANNOUNCEMENT_CONTENT_LENGTH,
  MAX_ANNOUNCEMENT_RECIPIENT_COUNT,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "@/constants/announcement";

export const createAnnouncementSchema = z.object({
  organizationId: z.uuid(),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(MAX_ANNOUNCEMENT_TITLE_LENGTH),
  content: z.string().trim().min(1, "내용을 입력해 주세요.").max(MAX_ANNOUNCEMENT_CONTENT_LENGTH),
  priority: z.enum([AnnouncementPriority.NORMAL, AnnouncementPriority.IMPORTANT]),
  audience: z.enum([AnnouncementAudience.ALL_MEMBERS, AnnouncementAudience.SELECTED_MEMBERS]),
});

export const announcementReferenceSchema = z.object({
  organizationId: z.uuid(),
  announcementId: z.uuid(),
});

export const recipientIdsSchema = z.array(z.uuid()).max(MAX_ANNOUNCEMENT_RECIPIENT_COUNT);
