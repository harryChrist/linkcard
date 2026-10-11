import { describe, expect, it } from "vitest";

import { iconSource } from "@/lib/iconSource";

describe("iconSource", () => {
  it("returns null for empty or whitespace input", () => {
    expect(iconSource("")).toBeNull();
    expect(iconSource("   ")).toBeNull();
  });

  it("passes http(s) URLs through untouched", () => {
    expect(iconSource("https://example.com/icon.png")).toEqual({
      kind: "image",
      src: "https://example.com/icon.png",
    });
  });

  it("maps set:name references to Iconify", () => {
    expect(iconSource("mdi:web")).toEqual({
      kind: "image",
      src: "https://api.iconify.design/mdi/web.svg?color=%23ffffff",
      fallback: "https://api.iconify.design/mdi/link-variant.svg?color=%23ffffff",
    });
  });

  it("maps simple slugs to the SimpleIcons CDN with an Iconify fallback", () => {
    expect(iconSource("github")).toEqual({
      kind: "image",
      src: "https://cdn.simpleicons.org/github/ffffff",
      fallback: "https://api.iconify.design/simple-icons/github.svg?color=%23ffffff",
    });
  });

  it("routes CDN-blocked slugs straight to Iconify", () => {
    expect(iconSource("linkedin")).toEqual({
      kind: "image",
      src: "https://api.iconify.design/simple-icons/linkedin.svg?color=%23ffffff",
      fallback: "https://api.iconify.design/mdi/link-variant.svg?color=%23ffffff",
    });
  });

  it("renders unknown strings as text", () => {
    expect(iconSource("🚀")).toEqual({ kind: "text", text: "🚀" });
    expect(iconSource("not an icon")).toEqual({ kind: "text", text: "not an icon" });
  });
});
