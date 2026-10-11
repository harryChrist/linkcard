import { describe, expect, it } from "vitest";

import profileJson from "@/profile.json";
import {
  absoluteUrl,
  buildSeo,
  DEFAULT_ICON,
  DEFAULT_LANG,
  DEFAULT_THEME_COLOR,
  iconMimeType,
  renderSeoTags,
  SITE_NAME,
  type SeoDocument,
  type SeoTag,
} from "@/lib/seo";

/** Reads the `content` of a meta tag, whichever key (`name` or `property`) it uses. */
function contentOf(seo: SeoDocument, key: string, value: string): string | undefined {
  for (const tag of seo.tags) {
    if (tag.kind === "meta" && tag.attrs[key] === value) return tag.attrs.content;
  }
  return undefined;
}

function linkHref(seo: SeoDocument, rel: string): string | undefined {
  for (const tag of seo.tags) {
    if (tag.kind === "link" && tag.attrs.rel === rel) return tag.attrs.href;
  }
  return undefined;
}

const attributesOf = (seo: SeoDocument): Array<[string, string]> =>
  seo.tags.flatMap((tag: SeoTag) => Object.entries(tag.attrs));

describe("buildSeo", () => {
  it("uses the seo block from the shipped profile.json", () => {
    const seo = buildSeo(profileJson);

    expect(seo.title).toBe("LinkCard - HarryChrist");
    expect(seo.lang).toBe("pt-BR");
    expect(contentOf(seo, "name", "description")).toBe(profileJson.seo.description);
    expect(contentOf(seo, "property", "og:title")).toBe("LinkCard - HarryChrist");
    expect(contentOf(seo, "property", "og:url")).toBe("https://card.hchrist.com");
    expect(contentOf(seo, "property", "og:locale")).toBe("pt_BR");
    expect(contentOf(seo, "property", "profile:username")).toBe("HarryChrist");
    expect(linkHref(seo, "canonical")).toBe("https://card.hchrist.com");
    expect(seo.jsonLd).toContain('"@type":"Person"');
  });

  it("falls back to the banner, the avatar and the default icon", () => {
    const seo = buildSeo(profileJson);

    expect(contentOf(seo, "property", "og:image")).toBe(profileJson.media.bannerUrl);
    expect(contentOf(seo, "name", "twitter:card")).toBe("summary_large_image");
    expect(seo.icon).toBe(DEFAULT_ICON);
    expect(linkHref(seo, "icon")).toBe(DEFAULT_ICON);
  });

  it("derives a title from the handle when seo is missing", () => {
    expect(buildSeo({ identity: { handle: "dev" } }).title).toBe(`dev - ${SITE_NAME}`);
    expect(buildSeo({}).title).toBe(SITE_NAME);
  });

  it("falls back to the bio, then to a generic description", () => {
    expect(buildSeo({ identity: { bio: "Só uma bio." } }).tags[0].attrs.content).toBe(
      "Só uma bio.",
    );
    expect(contentOf(buildSeo({}), "name", "description")).toContain("link-in-bio");
  });

  it("survives malformed values without emitting an empty attribute", () => {
    const seo = buildSeo({
      seo: {
        title: 42,
        description: [],
        icon: "   ",
        themeColor: null,
        lang: 7,
        url: {},
        image: [],
      },
      identity: { handle: "   " },
      media: { bannerUrl: null },
    });

    expect(seo.title).toBe(SITE_NAME);
    expect(seo.themeColor).toBe(DEFAULT_THEME_COLOR);
    expect(seo.lang).toBe(DEFAULT_LANG);
    expect(seo.icon).toBe(DEFAULT_ICON);
    expect(seo.title).not.toBe("");
    for (const [name, value] of attributesOf(seo)) {
      expect(value, `attribute ${name} must not be empty`).not.toBe("");
    }
  });

  it("omits og:image and downgrades the card when there is no image", () => {
    const seo = buildSeo({ identity: { handle: "dev" } });

    expect(contentOf(seo, "property", "og:image")).toBeUndefined();
    expect(contentOf(seo, "name", "twitter:image")).toBeUndefined();
    expect(contentOf(seo, "name", "twitter:card")).toBe("summary");
  });

  it("resolves relative paths against the page URL", () => {
    const seo = buildSeo({
      seo: { url: "https://card.hchrist.com/", image: "/banner.png" },
      identity: { handle: "dev" },
      media: { avatarUrl: "/avatar.png" },
    });

    // An absolute URL is kept verbatim; only relative paths get joined.
    expect(linkHref(seo, "canonical")).toBe("https://card.hchrist.com/");
    expect(contentOf(seo, "property", "og:image")).toBe("https://card.hchrist.com/banner.png");
    expect(seo.jsonLd).toContain("https://card.hchrist.com/avatar.png");
  });
});

describe("absoluteUrl", () => {
  it("keeps absolute URLs, joins relative ones and leaves orphans alone", () => {
    expect(absoluteUrl("https://cdn.dev/a.png", "https://card.dev")).toBe("https://cdn.dev/a.png");
    expect(absoluteUrl("//cdn.dev/a.png", "https://card.dev")).toBe("//cdn.dev/a.png");
    expect(absoluteUrl("/a.png", "https://card.dev/")).toBe("https://card.dev/a.png");
    expect(absoluteUrl("a.png", "https://card.dev")).toBe("https://card.dev/a.png");
    expect(absoluteUrl("/a.png", "")).toBe("/a.png");
    expect(absoluteUrl("   ", "https://card.dev")).toBe("");
  });
});

describe("iconMimeType", () => {
  it("maps the extensions browsers care about", () => {
    expect(iconMimeType("/logo.svg")).toBe("image/svg+xml");
    expect(iconMimeType("https://x.dev/favicon.ico?v=2")).toBe("image/x-icon");
    expect(iconMimeType("/icon.png#hash")).toBe("image/png");
    expect(iconMimeType("/favicon")).toBe("");
  });
});

describe("renderSeoTags", () => {
  it("escapes attribute values and cannot be closed early by the profile", () => {
    const hostile = 'dev "quoted" </script><script>alert(1)</script>';
    const seo = buildSeo({ identity: { handle: "dev", bio: hostile } });
    const html = renderSeoTags(seo);

    expect(html.startsWith("<title>dev - LinkCard</title>")).toBe(true);
    expect(html).toContain("&lt;/script&gt;");
    expect(html).not.toContain("</script><script>");
    expect(html.split("</script>")).toHaveLength(2);
  });

  it("honours the requested line ending", () => {
    const seo = buildSeo(profileJson);
    const crlf = renderSeoTags(seo, "\r\n");
    const lines = seo.tags.length + 2; // <title>, every tag and the JSON-LD script

    expect(crlf.split("\r\n")).toHaveLength(lines);
    expect(crlf.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
