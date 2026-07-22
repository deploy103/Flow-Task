import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  INVITATION_CODE_PEPPER: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const authEmailEnvironmentSchema = z.object({
  RESEND_API_KEY: z.string().min(20),
  AUTH_EMAIL_FROM: z.string().min(3).max(320),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const storageEnvironmentSchema = z.object({
  LOCAL_STORAGE_ROOT: z.string().min(1).refine((value) => value.startsWith("/"), "Absolute path required."),
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

export function getAuthEmailEnvironment() {
  return authEmailEnvironmentSchema.parse(process.env);
}

export function getStorageEnvironment() {
  return storageEnvironmentSchema.parse({
    LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT,
  });
}

export function getCleanupEnvironment() {
  return cleanupEnvironmentSchema.parse({
    SUBMISSION_CLEANUP_SECRET: process.env.SUBMISSION_CLEANUP_SECRET,
  });
}
