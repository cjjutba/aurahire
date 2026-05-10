import { sanitizeMapUrl } from "./sanitize-map-url";

describe("sanitizeMapUrl", () => {
  it("accepts http and https URLs", () => {
    expect(sanitizeMapUrl("http://maps.google.com/?q=foo")).toBe(
      "http://maps.google.com/?q=foo",
    );
    expect(sanitizeMapUrl("https://maps.google.com/?q=foo")).toBe(
      "https://maps.google.com/?q=foo",
    );
  });
  it("rejects javascript:, data:, file:, mailto:, ftp:", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "mailto:foo@bar.com",
      "ftp://maps.google.com",
    ]) {
      expect(() => sanitizeMapUrl(bad)).toThrow(/Invalid map URL/);
    }
  });
  it("trims whitespace and returns null for empty input", () => {
    expect(sanitizeMapUrl(null)).toBeNull();
    expect(sanitizeMapUrl(undefined)).toBeNull();
    expect(sanitizeMapUrl("   ")).toBeNull();
    expect(sanitizeMapUrl("  https://x.example  ")).toBe("https://x.example");
  });
  it("rejects URLs over 2048 chars", () => {
    const long = "https://x." + "a".repeat(3000);
    expect(() => sanitizeMapUrl(long)).toThrow(/too long/);
  });
});
