import type { User as DatabaseUser } from "@prisma/client";
import type { User as AuthUser } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const DEFAULT_RECOVERED_PROFILE_NAME = "새 사용자";

const recoverySeedSchema = z.object({
  name: z.string().trim().min(2).max(50),
  studentNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9A-Za-z-]*$/)
    .optional()
    .transform((value) => value || undefined),
});

type RecoverySeed = z.infer<typeof recoverySeedSchema>;

type CreateProfileInput = RecoverySeed & {
  id: string;
  email: string;
};

export type UserProfileRepository = {
  findById: (id: string) => Promise<DatabaseUser | null>;
  create: (input: CreateProfileInput) => Promise<DatabaseUser>;
};

const prismaUserProfileRepository: UserProfileRepository = {
  findById: (id) => prisma.user.findUnique({ where: { id } }),
  create: (data) => prisma.user.create({ data }),
};

function getRecoverySeed(authUser: AuthUser, preferredSeed?: RecoverySeed) {
  const preferredResult = recoverySeedSchema.safeParse(preferredSeed);
  if (preferredResult.success) return preferredResult.data;

  const metadataResult = recoverySeedSchema.safeParse({
    name: authUser.user_metadata.name,
    studentNumber: authUser.user_metadata.student_number,
  });
  if (metadataResult.success) return metadataResult.data;

  return { name: DEFAULT_RECOVERED_PROFILE_NAME, studentNumber: undefined };
}

export async function ensureUserProfile(
  authUser: AuthUser,
  options: {
    preferredSeed?: RecoverySeed;
    repository?: UserProfileRepository;
  } = {},
) {
  const repository = options.repository ?? prismaUserProfileRepository;
  const existingProfile = await repository.findById(authUser.id);
  if (existingProfile) return existingProfile;

  const email = z.string().email().parse(authUser.email);
  const recoverySeed = getRecoverySeed(authUser, options.preferredSeed);

  try {
    return await repository.create({ id: authUser.id, email, ...recoverySeed });
  } catch (error) {
    // A concurrent request may have created the same profile first.
    const concurrentlyCreatedProfile = await repository.findById(authUser.id);
    if (concurrentlyCreatedProfile) return concurrentlyCreatedProfile;
    throw error;
  }
}
