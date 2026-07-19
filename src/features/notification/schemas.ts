import { z } from "zod";

export const notificationReferenceSchema = z.object({ notificationId: z.uuid() });
