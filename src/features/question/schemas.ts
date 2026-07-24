import { MentorRelationType, QuestionBoardType, QuestionCategory, QuestionStatus } from "@prisma/client";
import { z } from "zod";

export const createQuestionSchema = z.object({ organizationId: z.uuid(), boardType: z.enum(QuestionBoardType), category: z.enum(QuestionCategory), title: z.string().trim().min(2).max(120), content: z.string().trim().min(10).max(20000), attempted: z.string().trim().max(10000), errorMessage: z.string().trim().max(10000), code: z.string().max(20000), relatedAssignmentId: z.union([z.literal(""), z.uuid()]) });
export const questionReferenceSchema = z.object({ organizationId: z.uuid(), questionId: z.uuid() });
export const updateQuestionSchema = createQuestionSchema.omit({ boardType: true }).extend({ questionId: z.uuid() });
export const deleteQuestionSchema = questionReferenceSchema.extend({ confirmationTitle: z.string().trim().min(2).max(120) });
export const answerSchema = questionReferenceSchema.extend({ content: z.string().trim().min(1).max(20000), code: z.string().max(20000), parentId: z.union([z.literal(""), z.uuid()]) });
export const statusSchema = questionReferenceSchema.extend({ status: z.enum(QuestionStatus) });
export const acceptAnswerSchema = questionReferenceSchema.extend({ answerId: z.uuid() });
export const mentorRelationSchema = z.object({ organizationId: z.uuid(), mentorId: z.uuid(), menteeId: z.uuid(), type: z.enum(MentorRelationType) }).refine((data) => data.mentorId !== data.menteeId);
export const mentorRelationReferenceSchema = z.object({ organizationId: z.uuid(), relationId: z.uuid() });
export const assignQuestionMentorSchema = questionReferenceSchema.extend({ mentorId: z.uuid() });
