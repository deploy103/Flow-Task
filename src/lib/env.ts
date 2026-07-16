import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  INVITATION_CODE_PEPPER: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const publicEnvironmentSchema = serverEnvironmentSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
});

const storageEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  SUBMISSION_STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,62}$/),
});

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse(process.env);
}

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getStorageEnvironment() {
  return storageEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUBMISSION_STORAGE_BUCKET: process.env.SUBMISSION_STORAGE_BUCKET,
  });
}
