import { randomUUID } from "node:crypto";
import { MAX_ORGANIZATION_LOGO_BYTES, ORGANIZATION_LOGO_MIME_TYPES } from "@/constants/organization";
import { readPrivateFile, removePrivateFile, writePrivateFile } from "@/lib/storage/local";

export type OrganizationLogo = {
  file: File;
  extension: keyof typeof ORGANIZATION_LOGO_MIME_TYPES;
  mimeType: string;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasValidOrganizationLogoSignature(bytes: Uint8Array, extension: OrganizationLogo["extension"]) {
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "jpg" || extension === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
}

export async function validateOrganizationLogo(value: FormDataEntryValue | null): Promise<OrganizationLogo | null> {
  if (!(value instanceof File) || (value.size === 0 && value.name === "")) return null;
  const extension = value.name.split(".").pop()?.toLowerCase() as OrganizationLogo["extension"] | undefined;
  if (!extension || !(extension in ORGANIZATION_LOGO_MIME_TYPES)) throw new Error("INVALID_LOGO");
  const expectedMimeType = ORGANIZATION_LOGO_MIME_TYPES[extension];
  if (value.size <= 0 || value.size > MAX_ORGANIZATION_LOGO_BYTES || value.type.toLowerCase() !== expectedMimeType) {
    throw new Error("INVALID_LOGO");
  }
  const signature = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  if (!hasValidOrganizationLogoSignature(signature, extension)) throw new Error("INVALID_LOGO");
  return { file: value, extension, mimeType: expectedMimeType };
}

export function organizationLogoPath(organizationId: string, extension: OrganizationLogo["extension"]) {
  return `${organizationId}/branding/${randomUUID()}.${extension}`;
}

export async function uploadOrganizationLogo(storagePath: string, file: File) {
  await writePrivateFile(storagePath, await file.arrayBuffer());
}

export function downloadOrganizationLogo(storagePath: string) {
  return readPrivateFile(storagePath);
}

export function removeOrganizationLogo(storagePath: string) {
  return removePrivateFile(storagePath);
}
