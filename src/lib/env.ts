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

const cleanupEnvironmentSchema = z.object({
  SUBMISSION_CLEANUP_SECRET: z.string().min(32),
});

const integrationEnvironmentSchema = z.object({
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32),
  EXTERNAL_SERVICE_ALLOWED_HOSTS: z.string().default(""),
});

const notificationDeliveryEnvironmentSchema = integrationEnvironmentSchema.extend({
  NOTIFICATION_DELIVERY_SECRET: z.string().min(32),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(40),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(20),
  WEB_PUSH_SUBJECT: z.string().regex(/^mailto:.+@.+$/),
});

const instanceProviderEnvironmentSchema = z.object({
  INSTANCE_PROVIDER_URL: z.url(),
  INSTANCE_PROVIDER_TOKEN: z.string().min(32),
  EXTERNAL_SERVICE_ALLOWED_HOSTS: z.string().default(""),
});

function withAllowedHosts<T extends { EXTERNAL_SERVICE_ALLOWED_HOSTS: string }>(value: T) {
  return { ...value, allowedHosts: value.EXTERNAL_SERVICE_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean) };
}

export function getIntegrationEnvironment() { return withAllowedHosts(integrationEnvironmentSchema.parse(process.env)); }
export function getNotificationDeliveryEnvironment() { return withAllowedHosts(notificationDeliveryEnvironmentSchema.parse(process.env)); }
export function getInstanceProviderEnvironment() { return withAllowedHosts(instanceProviderEnvironmentSchema.parse(process.env)); }

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

export function getCleanupEnvironment() {
  return cleanupEnvironmentSchema.parse({
    SUBMISSION_CLEANUP_SECRET: process.env.SUBMISSION_CLEANUP_SECRET,
  });
}
