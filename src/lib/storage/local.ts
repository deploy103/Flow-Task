import { mkdir, open, readFile, stat, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { getStorageEnvironment } from "@/lib/env";

const SAFE_STORAGE_PATH = /^[A-Za-z0-9._/-]+$/;
const MINIMUM_FREE_BYTES_AFTER_WRITE = 512 * 1024 * 1024;

export function resolvePrivateStoragePath(storagePath: string) {
  const { LOCAL_STORAGE_ROOT } = getStorageEnvironment();
  if (
    !storagePath ||
    !SAFE_STORAGE_PATH.test(storagePath) ||
    path.isAbsolute(storagePath) ||
    storagePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) throw new Error("INVALID_STORAGE_PATH");
  const root = path.resolve(LOCAL_STORAGE_ROOT);
  const resolved = path.resolve(root, storagePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("INVALID_STORAGE_PATH");
  return resolved;
}

export async function writePrivateFile(storagePath: string, bytes: ArrayBuffer | Uint8Array) {
  const target = resolvePrivateStoragePath(storagePath);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const filesystem = await statfs(path.dirname(target));
  const availableBytes = filesystem.bavail * filesystem.bsize;
  const inputBytes = bytes.byteLength;
  if (availableBytes - inputBytes < MINIMUM_FREE_BYTES_AFTER_WRITE) {
    throw new Error("LOCAL_STORAGE_CAPACITY_LOW");
  }
  const file = await open(target, "wx", 0o600);
  try {
    await file.writeFile(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } finally {
    await file.close();
  }
}

export async function readPrivateFile(storagePath: string) {
  return readFile(resolvePrivateStoragePath(storagePath));
}

export async function readPrivateFilePrefix(storagePath: string, length: number) {
  const file = await open(resolvePrivateStoragePath(storagePath), "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, 0);
    return new Uint8Array(buffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

export async function privateFileSize(storagePath: string) {
  const info = await stat(resolvePrivateStoragePath(storagePath));
  if (!info.isFile()) throw new Error("STORAGE_OBJECT_NOT_FILE");
  return info.size;
}

export async function removePrivateFile(storagePath: string) {
  try {
    await unlink(resolvePrivateStoragePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
