/**
 * Derives the page's title, meta tags and structured data from `profile.json`.
 *
 * The builder is pure and framework-free on purpose: the Vite plugin in
 * `vite.config.ts` bakes the result into `index.html`, and `Profile.tsx` applies
 * the same document to the live DOM. Unfurlers (Discord, Slack, X) and most
 * crawlers never run the bundle, so the baked copy is the one they read.
 *
 * Everything is optional and degrades to a value derived from the rest of the
 * profile (title from the handle, description from the bio, image from the
 * banner) or to the defaults below.
 */

import { buildProfileView, readMedia } from "./profile";

export const SITE_NAME = "LinkCard";
export const DEFAULT_TITLE = SITE_NAME;
export const DEFAULT_DESCRIPTION =
  "Perfil link-in-bio em página única: uma carta de vidro sobre um vídeo de fundo, com links, badges e presença.";
export const DEFAULT_THEME_COLOR = "#08090c";
export const DEFAULT_LANG = "pt-BR";
export const DEFAULT_ICON = "/logo.svg";

/** Markers in `index.html` that the Vite plugin replaces with the generated block. */
export const SEO_START = "<!-- seo:start -->";
export const SEO_END = "<!-- seo:end -->";

/**
 * Applied to the live DOM by `seoDom.ts`, which is the only DOM-aware module
 * here: this one stays importable from `vite.config.ts`, a Node context.
 */
export const JSON_LD_ATTR = "data-seo";
export const JSON_LD_SELECTOR = 'script[data-seo="json-ld"]';

export type SeoTag =
  { kind: "meta"; attrs: Record<string, string> } | { kind: "link"; attrs: Record<string, string> };

export type SeoDocument = {
  title: string;
  lang: string;
  themeColor: string;
  icon: string;
  tags: SeoTag[];
  jsonLd: string;
};

const ICON_MIME_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Turns a profile-relative path into the absolute URL crawlers expect. */
export function absoluteUrl(value: string, base = ""): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;

  const root = base.trim().replace(/\/+$/, "");
  if (!root) return trimmed;
  return trimmed.startsWith("/") ? `${root}${trimmed}` : `${root}/${trimmed}`;
}

/** MIME type of an icon URL, or `""` when the extension says nothing useful. */
export function iconMimeType(url: string): string {
  const path = url.trim().split(/[?#]/)[0] ?? "";
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return ICON_MIME_TYPES[extension] ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact JSON-LD; `<` is escaped so a bio can never close the wrapping script. */
function buildJsonLd(input: {
  name: string;
  jobTitle: string;
  description: string;
  url: string;
  image: string;
  sameAs: string[];
}): string {
  const person: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
  };

  if (input.jobTitle) person.jobTitle = input.jobTitle;
  if (input.description) person.description = input.description;
  if (input.url) person.url = input.url;
  if (input.image) person.image = input.image;
  if (input.sameAs.length > 0) person.sameAs = input.sameAs;

  return JSON.stringify(person).replace(/</g, "\\u003c");
}

export function buildSeo(raw: unknown, options: { baseUrl?: string } = {}): SeoDocument {
  const root = isRecord(raw) ? raw : {};
  const seo = isRecord(root.seo) ? root.seo : {};
  const profile = buildProfileView(raw);
  const media = readMedia(raw);

  const handle = profile.displayName === "anonymous" ? "" : profile.displayName;
  const pageUrl = absoluteUrl(str(seo.url), options.baseUrl ?? "");
  const title = str(seo.title).trim() || (handle ? `${handle} - ${SITE_NAME}` : DEFAULT_TITLE);
  const description = str(seo.description).trim() || profile.bio.trim() || DEFAULT_DESCRIPTION;
  const lang = str(seo.lang).trim() || DEFAULT_LANG;
  const themeColor = str(seo.themeColor).trim() || DEFAULT_THEME_COLOR;
  const icon = str(seo.icon).trim() || DEFAULT_ICON;
  const image = absoluteUrl(str(seo.image).trim() || media.bannerUrl || media.avatarUrl, pageUrl);

  const tags: SeoTag[] = [
    { kind: "meta", attrs: { name: "description", content: description } },
    { kind: "meta", attrs: { name: "theme-color", content: themeColor } },
  ];

  if (pageUrl) tags.push({ kind: "link", attrs: { rel: "canonical", href: pageUrl } });

  const iconAttrs: Record<string, string> = { rel: "icon", href: icon };
  const iconType = iconMimeType(icon);
  if (iconType) iconAttrs.type = iconType;
  tags.push({ kind: "link", attrs: iconAttrs });

  const openGraph: Array<[string, string]> = [
    ["og:type", "profile"],
    ["og:site_name", SITE_NAME],
    ["og:title", title],
    ["og:description", description],
    ["og:locale", lang.replace(/-/g, "_")],
  ];
  if (pageUrl) openGraph.push(["og:url", pageUrl]);
  if (image) openGraph.push(["og:image", image], ["og:image:alt", title]);
  if (handle) openGraph.push(["profile:username", handle]);
  for (const [property, content] of openGraph) {
    tags.push({ kind: "meta", attrs: { property, content } });
  }

  const twitter: Array<[string, string]> = [
    ["twitter:card", image ? "summary_large_image" : "summary"],
    ["twitter:title", title],
    ["twitter:description", description],
  ];
  if (image) twitter.push(["twitter:image", image]);
  for (const [name, content] of twitter) {
    tags.push({ kind: "meta", attrs: { name, content } });
  }

  return {
    title,
    lang,
    themeColor,
    icon,
    tags,
    jsonLd: buildJsonLd({
      name: handle || SITE_NAME,
      jobTitle: profile.title.trim(),
      description: profile.bio.trim(),
      url: pageUrl,
      image: absoluteUrl(media.avatarUrl, pageUrl),
      sameAs: profile.links.map((link) => link.url),
    }),
  };
}

/**
 * Serialises the document as the `<head>` block injected into `index.html`.
 * `lineEnding` follows the host file so a CRLF checkout is not half-converted.
 */
export function renderSeoTags(seo: SeoDocument, lineEnding = "\n"): string {
  const lines = [`<title>${escapeHtml(seo.title)}</title>`];

  for (const tag of seo.tags) {
    const attrs = Object.entries(tag.attrs)
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(" ");
    lines.push(`<${tag.kind} ${attrs} />`);
  }

  lines.push(`<script type="application/ld+json" ${JSON_LD_ATTR}="json-ld">${seo.jsonLd}</script>`);
  return lines.join(lineEnding);
}
