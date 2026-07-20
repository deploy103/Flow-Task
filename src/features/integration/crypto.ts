import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret: string) { if (secret.length < 32) throw new Error("INTEGRATION_ENCRYPTION_KEY_REQUIRED"); return createHash("sha256").update(secret).digest(); }

export function encryptIntegrationValue(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptIntegrationValue(value: string, secret: string) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("INVALID_INTEGRATION_CIPHERTEXT");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
