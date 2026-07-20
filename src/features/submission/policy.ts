import {
  MAX_SUBMISSION_FILE_COUNT,
  MAX_SUBMISSION_FILE_SIZE_BYTES,
  MAX_SUBMISSION_FILENAME_LENGTH,
  MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES,
  SUBMISSION_FILE_MIME_TYPES,
} from "@/constants/assignment";

export type ValidatedSubmissionFile = {
  extension: keyof typeof SUBMISSION_FILE_MIME_TYPES;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
};

export type SubmissionFileCollectionResult =
  | { success: true; files: File[] }
  | { success: false; reason: "invalid_entry" | "too_many" | "total_too_large" };

function getSafeOriginalFilename(name: string) {
  const basename = name.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!basename || basename.length > MAX_SUBMISSION_FILENAME_LENGTH || /[\u0000-\u001f\u007f]/.test(basename)) {
    return null;
  }
  return basename;
}

export function validateSubmissionFileMetadata(file: {
  name: string;
  size: number;
  type: string;
}): ValidatedSubmissionFile | null {
  const originalFilename = getSafeOriginalFilename(file.name);
  const extension = originalFilename?.split(".").pop()?.toLowerCase();
  if (!originalFilename || !extension || !(extension in SUBMISSION_FILE_MIME_TYPES)) return null;
  if (file.size <= 0 || file.size > MAX_SUBMISSION_FILE_SIZE_BYTES) return null;

  const allowedMimeTypes = SUBMISSION_FILE_MIME_TYPES[extension as keyof typeof SUBMISSION_FILE_MIME_TYPES];
  if (!(allowedMimeTypes as readonly string[]).includes(file.type.toLowerCase())) return null;

  return {
    extension: extension as keyof typeof SUBMISSION_FILE_MIME_TYPES,
    mimeType: file.type.toLowerCase(),
    originalFilename,
    sizeBytes: file.size,
  };
}

export function validateSubmissionFile(file: File) {
  return validateSubmissionFileMetadata(file);
}

export function collectSubmissionFiles(
  values: FormDataEntryValue[],
): SubmissionFileCollectionResult {
  const files: File[] = [];
  for (const value of values) {
    if (!(value instanceof File)) return { success: false, reason: "invalid_entry" };
    if (value.size === 0 && value.name === "") continue;
    files.push(value);
  }
  if (files.length > MAX_SUBMISSION_FILE_COUNT) return { success: false, reason: "too_many" };
  const totalSizeBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalSizeBytes > MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES) {
    return { success: false, reason: "total_too_large" };
  }
  return { success: true, files };
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasValidSubmissionFileSignatureBytes(
  bytes: Uint8Array,
  extension: keyof typeof SUBMISSION_FILE_MIME_TYPES,
) {
  if (extension === "pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "jpg" || extension === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === "hwp") return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

export async function hasValidSubmissionFileSignature(
  file: File,
  extension: keyof typeof SUBMISSION_FILE_MIME_TYPES,
) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return hasValidSubmissionFileSignatureBytes(bytes, extension);
}

export function isSafeSubmissionUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
