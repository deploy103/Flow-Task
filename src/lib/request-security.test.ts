import { describe, expect, it } from "vitest";
import { hasTrustedMutationOrigin, readBoundedJson, resolveTrustedClientIp } from "./request-security";

describe("mutation request security", () => {
  it("accepts the request origin and rejects missing or cross-site origins", () => {
    expect(hasTrustedMutationOrigin(new Request("https://flow.example.com/api", { headers: { Origin: "https://flow.example.com" } }))).toBe(true);
    expect(hasTrustedMutationOrigin(new Request("https://flow.example.com/api"))).toBe(false);
    expect(hasTrustedMutationOrigin(new Request("https://flow.example.com/api", { headers: { Origin: "https://attacker.example" } }))).toBe(false);
  });

  it("accepts a configured public origin behind an internal proxy", () => {
    expect(hasTrustedMutationOrigin(new Request("http://app:3000/api", { headers: { Origin: "https://flow.example.com" } }), "https://flow.example.com", true)).toBe(true);
  });

  it("does not trust an attacker-controlled request host in production", () => {
    const rebound = new Request("https://attacker.example/api", { headers: { Origin: "https://attacker.example" } });
    expect(hasTrustedMutationOrigin(rebound, "https://flow.example.com", true)).toBe(false);
    expect(hasTrustedMutationOrigin(rebound, undefined, true)).toBe(false);
    expect(hasTrustedMutationOrigin(rebound, undefined, false)).toBe(true);
  });

  it("uses only a proxy-overwritten real IP when proxy trust is explicit", () => {
    const headers = { get: (name: string) => ({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.4" })[name.toLowerCase()] ?? null };
    expect(resolveTrustedClientIp(headers, false)).toBeNull();
    expect(resolveTrustedClientIp(headers, true)).toBe("203.0.113.9");
    expect(resolveTrustedClientIp({ get: () => "203.0.113.9, 10.0.0.2" }, true)).toBeNull();
  });
});

describe("bounded JSON reader", () => {
  it("parses valid JSON with or without a declared length", async () => {
    const body = JSON.stringify({ value: "safe" });
    await expect(readBoundedJson(new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(body.length) }, body }), 100)).resolves.toEqual({ success: true, data: { value: "safe" } });
    await expect(readBoundedJson(new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json" }, body }), 100)).resolves.toEqual({ success: true, data: { value: "safe" } });
  });

  it("stops an undeclared streaming body after the byte limit", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"value":"')); controller.enqueue(new TextEncoder().encode("a".repeat(100))); controller.enqueue(new TextEncoder().encode('"}')); controller.close(); } });
    const request = new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    await expect(readBoundedJson(request, 32)).resolves.toEqual({ success: false });
  });

  it("does not trust a declared length that is smaller than the streamed body", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify({ value: "a".repeat(100) }))); controller.close(); } });
    const request = new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "16" }, body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    await expect(readBoundedJson(request, 32)).resolves.toEqual({ success: false });
  });

  it("rejects wrong content types, invalid lengths and malformed JSON", async () => {
    await expect(readBoundedJson(new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }), 32)).resolves.toEqual({ success: false });
    await expect(readBoundedJson(new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "100" }, body: "{}" }), 32)).resolves.toEqual({ success: false });
    await expect(readBoundedJson(new Request("https://flow.example.com/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), 32)).resolves.toEqual({ success: false });
  });
});
