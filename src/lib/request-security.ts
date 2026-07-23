const JSON_CONTENT_TYPE = "application/json";

function parseOrigin(value: string | null) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

export function hasTrustedMutationOrigin(request: Request) {
  const origin = parseOrigin(request.headers.get("origin"));
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL ?? null);
  return origin === requestOrigin || origin === configuredOrigin;
}

export async function readBoundedJson(request: Request, maximumBytes: number): Promise<{ success: true; data: unknown } | { success: false }> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) return { success: false };
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== JSON_CONTENT_TYPE) return { success: false };
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength <= 0 || parsedLength > maximumBytes) return { success: false };
  }
  if (!request.body) return { success: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return { success: false };
      }
      chunks.push(value);
    }
  } catch {
    return { success: false };
  }
  if (totalBytes === 0) return { success: false };
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return { success: true, data: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { success: false };
  }
}
