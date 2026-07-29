import { lookup, type LookupAddress, type LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch, type RequestInit } from "undici";

export const MAX_EXTERNAL_JSON_RESPONSE_BYTES = 16 * 1024;

export function isPublicNetworkAddress(value: string) {
  try {
    return ipaddr.process(value).range() === "unicast";
  } catch {
    return false;
  }
}

export function selectPublicDnsAddress(addresses: ReadonlyArray<{ address: string; family: number }>) {
  if (!addresses.length || addresses.some(({ address }) => !isPublicNetworkAddress(address))) return null;
  return addresses[0] ?? null;
}

type AllAddressLookup = (
  hostname: string,
  options: LookupOptions & { all: true },
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

const systemAllAddressLookup: AllAddressLookup = (hostname, options, callback) => {
  lookup(hostname, options, callback);
};

export function createPublicNetworkLookup(
  resolveAddresses: AllAddressLookup = systemAllAddressLookup,
  addressAllowed: (address: string) => boolean = isPublicNetworkAddress,
): LookupFunction {
  return (hostname, options, callback) => {
    resolveAddresses(
      hostname,
      { all: true, family: options.family, hints: options.hints, verbatim: true },
      (error, addresses) => {
        if (error) {
          callback(error, options.all ? [] : "", options.all ? undefined : 0);
          return;
        }
        if (!addresses.length || addresses.some(({ address }) => !addressAllowed(address))) {
          const rejection = new Error("OUTBOUND_PRIVATE_ADDRESS_REJECTED");
          callback(rejection, options.all ? [] : "", options.all ? undefined : 0);
          return;
        }
        if (options.all) {
          callback(null, addresses);
          return;
        }
        const selected = addresses[0];
        callback(null, selected.address, selected.family);
      },
    );
  };
}

export function validatePublicHttpsUrl(input: string | URL) {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const literal = url.hostname.startsWith("[") && url.hostname.endsWith("]")
      ? url.hostname.slice(1, -1)
      : url.hostname;
    if (ipaddr.isValid(literal) && !isPublicNetworkAddress(literal)) return null;
    return url;
  } catch {
    return null;
  }
}

const publicNetworkAgent = new Agent({
  connect: {
    lookup: createPublicNetworkLookup(),
  },
});

export function fetchPublicNetwork(input: string | URL, init: RequestInit) {
  const url = validatePublicHttpsUrl(input);
  if (!url) throw new Error("OUTBOUND_URL_REJECTED");
  return fetch(url, { ...init, dispatcher: publicNetworkAgent });
}

export async function readBoundedJsonResponse(
  response: {
    headers: { get(name: string): string | null };
    body: { getReader(): ReadableStreamDefaultReader<Uint8Array> } | null;
  },
  maximumBytes = MAX_EXTERNAL_JSON_RESPONSE_BYTES,
) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) throw new Error("INVALID_RESPONSE_LIMIT");
  const rejectResponse = async (message: string): Promise<never> => {
    await response.body?.getReader().cancel();
    throw new Error(message);
  };
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return rejectResponse("EXTERNAL_RESPONSE_CONTENT_TYPE_REJECTED");
  const declaredLength = response.headers.get("content-length");
  let expectedLength: number | null = null;
  if (declaredLength !== null) {
    if (!/^(?:0|[1-9]\d*)$/.test(declaredLength)) {
      return rejectResponse("EXTERNAL_RESPONSE_CONTENT_LENGTH_REJECTED");
    }
    expectedLength = Number(declaredLength);
    if (!Number.isSafeInteger(expectedLength) || expectedLength > maximumBytes) {
      return rejectResponse("EXTERNAL_RESPONSE_TOO_LARGE");
    }
  }
  if (!response.body) throw new Error("EXTERNAL_RESPONSE_EMPTY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("EXTERNAL_RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  if (!total) throw new Error("EXTERNAL_RESPONSE_EMPTY");
  if (expectedLength !== null && total !== expectedLength) {
    throw new Error("EXTERNAL_RESPONSE_CONTENT_LENGTH_MISMATCH");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}
