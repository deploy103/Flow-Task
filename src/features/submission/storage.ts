import { randomUUID } from "node:crypto";
import {
  privateFileSize,
  readPrivateFile,
  readPrivateFilePrefix,
  removePrivateFile,
  writePrivateFile,
} from "@/lib/storage/local";
import {
  hasValidSubmissionFileSignatureBytes,
  type ValidatedSubmissionFile,
} from "./policy";

export async function uploadSubmissionFile(storagePath: string, file: File) {
  await writePrivateFile(storagePath, await file.arrayBuffer());
}

export async function verifyStoredSubmissionUpload(input: {
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  extension: ValidatedSubmissionFile["extension"];
}) {
  if (await privateFileSize(input.storagePath) !== input.sizeBytes) return false;
  const bytes = await readPrivateFilePrefix(input.storagePath, 8);
  return hasValidSubmissionFileSignatureBytes(bytes, input.extension);
}

export function createSubmissionStoragePath(input: {
  organizationId: string;
  assignmentId: string;
  userId: string;
  extension: string;
}) {
  return `${input.organizationId}/${input.assignmentId}/${input.userId}/${randomUUID()}.${input.extension}`;
}

export async function removeSubmissionFile(storagePath: string) {
  await removePrivateFile(storagePath);
}

export async function downloadSubmissionFile(storagePath: string) {
  return readPrivateFile(storagePath);
}
