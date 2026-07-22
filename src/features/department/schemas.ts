import { z } from "zod";
import { MAX_DEPARTMENT_DESCRIPTION_LENGTH, MAX_DEPARTMENT_MESSAGE_LENGTH, MAX_DEPARTMENT_NAME_LENGTH } from "@/constants/department";

export const createDepartmentSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(MAX_DEPARTMENT_NAME_LENGTH),
  description: z.string().trim().max(MAX_DEPARTMENT_DESCRIPTION_LENGTH).transform((value) => value || null),
});

export const updateDepartmentSchema = createDepartmentSchema.extend({
  departmentId: z.uuid(),
});

export const departmentMemberSchema = z.object({
  organizationId: z.uuid(),
  departmentId: z.uuid(),
  leaderId: z.union([z.literal(""), z.uuid()]),
  memberIds: z.array(z.uuid()).max(500),
});

export const departmentMessageSchema = z.object({
  organizationId: z.uuid(),
  departmentId: z.uuid(),
  content: z.string().trim().min(1).max(MAX_DEPARTMENT_MESSAGE_LENGTH),
});
