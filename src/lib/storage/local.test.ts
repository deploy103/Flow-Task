import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  privateFileSize,
  readPrivateFile,
  readPrivateFilePrefix,
  removePrivateFile,
  resolvePrivateStoragePath,
  writePrivateFile,
} from "./local";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("local private storage paths", () => {
  it("keeps generated object paths below the configured root", () => {
    process.env.LOCAL_STORAGE_ROOT = "/var/lib/flow-task/uploads";
    expect(resolvePrivateStoragePath("org/assignments/file.pdf")).toBe("/var/lib/flow-task/uploads/org/assignments/file.pdf");
  });

  it.each(["../secret", "/etc/passwd", "org//file", "org/./file", "org\\file"])(
    "rejects unsafe path %s",
    (value) => {
      process.env.LOCAL_STORAGE_ROOT = "/var/lib/flow-task/uploads";
      expect(() => resolvePrivateStoragePath(value)).toThrow("INVALID_STORAGE_PATH");
    },
  );

  it("writes, reads, verifies, and idempotently removes private files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flow-task-storage-test-"));
    temporaryDirectories.push(root);
    process.env.LOCAL_STORAGE_ROOT = root;
    const storagePath = "organization/submissions/file.pdf";
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4, 5]);

    await writePrivateFile(storagePath, bytes);
    await expect(privateFileSize(storagePath)).resolves.toBe(bytes.length);
    expect(await readPrivateFilePrefix(storagePath, 4)).toEqual(bytes.slice(0, 4));
    expect(await readPrivateFile(storagePath)).toEqual(Buffer.from(bytes));
    await expect(writePrivateFile(storagePath, bytes)).rejects.toMatchObject({ code: "EEXIST" });
    await removePrivateFile(storagePath);
    await expect(removePrivateFile(storagePath)).resolves.toBeUndefined();
  });
});
