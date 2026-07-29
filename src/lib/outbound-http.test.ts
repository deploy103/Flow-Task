import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Agent, fetch } from "undici";
import { describe, expect, it } from "vitest";
import { createPublicNetworkLookup, isPublicNetworkAddress, readBoundedJsonResponse, selectPublicDnsAddress, validatePublicHttpsUrl } from "./outbound-http";

describe("outbound network policy", () => {
  it("allows globally routable addresses and rejects local, private and mapped addresses", () => {
    expect(isPublicNetworkAddress("8.8.8.8")).toBe(true);
    expect(isPublicNetworkAddress("2606:4700:4700::1111")).toBe(true);
    for (const address of ["0.0.0.0", "127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.0.2.1", "198.18.0.1", "224.0.0.1", "::1", "2001:db8::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicNetworkAddress(address)).toBe(false);
    }
  });

  it("requires HTTPS and rejects private IP literals before a socket is opened", () => {
    expect(validatePublicHttpsUrl("https://example.com/hook")?.hostname).toBe("example.com");
    expect(validatePublicHttpsUrl("http://example.com/hook")).toBeNull();
    expect(validatePublicHttpsUrl("https://user:pass@example.com/hook")).toBeNull();
    expect(validatePublicHttpsUrl("https://127.0.0.1/hook")).toBeNull();
    expect(validatePublicHttpsUrl("https://[::1]/hook")).toBeNull();
    expect(validatePublicHttpsUrl("https://[::ffff:127.0.0.1]/hook")).toBeNull();
  });

  it("fails closed when any DNS answer could reach a non-public network", () => {
    expect(selectPublicDnsAddress([{ address: "8.8.8.8", family: 4 }])).toEqual({ address: "8.8.8.8", family: 4 });
    expect(selectPublicDnsAddress([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.8", family: 4 }])).toBeNull();
    expect(selectPublicDnsAddress([])).toBeNull();
  });

  it("returns an address array when Undici requests all lookup results", async () => {
    const server = createServer((_request, response) => response.end("ok"));
    await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
    const { port } = server.address() as AddressInfo;
    const dispatcher = new Agent({
      connect: {
        lookup: createPublicNetworkLookup(
          (_hostname, _options, callback) => callback(null, [{ address: "127.0.0.1", family: 4 }]),
          () => true,
        ),
      },
    });
    try {
      const response = await fetch(`http://lookup-contract.test:${port}`, { dispatcher });
      await expect(response.text()).resolves.toBe("ok");
    } finally {
      await dispatcher.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("reads only bounded JSON responses", async () => {
    await expect(readBoundedJsonResponse(new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }), 64)).resolves.toEqual({ ok: true });
    await expect(readBoundedJsonResponse(new Response("x".repeat(65), { headers: { "Content-Type": "application/json" } }), 64)).rejects.toThrow("EXTERNAL_RESPONSE_TOO_LARGE");
    await expect(readBoundedJsonResponse(new Response("{}", { headers: { "Content-Type": "text/plain" } }), 64)).rejects.toThrow("EXTERNAL_RESPONSE_CONTENT_TYPE_REJECTED");
    await expect(readBoundedJsonResponse(new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "1e2" } }), 64)).rejects.toThrow("EXTERNAL_RESPONSE_CONTENT_LENGTH_REJECTED");
    await expect(readBoundedJsonResponse(new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "3" } }), 64)).rejects.toThrow("EXTERNAL_RESPONSE_CONTENT_LENGTH_MISMATCH");
  });
});
