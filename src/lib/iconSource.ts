/**
 * Resolves an `icon` string from `profile.json` into something renderable.
 *
 * Resolution order:
 *  1. empty string                -> no icon at all (`null`)
 *  2. `http(s)://…` URL           -> load that image directly
 *  3. `set:name` (e.g. `mdi:web`) -> Iconify
 *  4. simple slug (e.g. `github`) -> SimpleIcons CDN, falling back to Iconify
 *  5. any other string (emoji)    -> rendered as text
 *
 * The result never changes between calls for the same input: it is a pure
 * function whose output the renderer uses to do a single, bounded fallback
 * swap on image error (no `onError` loop).
 */

export type IconSource =
  | { kind: "image"; src: string; fallback?: string }
  | { kind: "text"; text: string };

const ICONIFY_BASE = "https://api.iconify.design";
const SIMPLE_ICONS_BASE = "https://cdn.simpleicons.org";

/** Slugs that are not available on the SimpleIcons CDN. */
const CDN_BLOCKED_SLUGS = new Set(["linkedin"]);

/** Generic glyph used when a configured icon image fails to load. */
const GENERIC_ICON = `${ICONIFY_BASE}/mdi/link-variant.svg?color=%23ffffff`;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

function iconifyUrl(set: string, name: string): string {
  return `${ICONIFY_BASE}/${encodeURIComponent(set)}/${encodeURIComponent(name)}.svg?color=%23ffffff`;
}

function simpleIconsUrl(slug: string): string {
  return `${SIMPLE_ICONS_BASE}/${encodeURIComponent(slug)}/ffffff`;
}

export function iconSource(icon: string): IconSource | null {
  const raw = (icon ?? "").trim();
  if (!raw) return null;

  // 2. Explicit image URL provided by the profile author.
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image/")) {
    return { kind: "image", src: raw };
  }

  // 3. Iconify reference: `set:name`.
  if (raw.includes(":")) {
    const separator = raw.indexOf(":");
    const set = raw.slice(0, separator).trim();
    const name = raw.slice(separator + 1).trim();
    if (set && name) {
      return { kind: "image", src: iconifyUrl(set, name), fallback: GENERIC_ICON };
    }
    return { kind: "text", text: raw };
  }

  // 4. Simple slug.
  if (SLUG_PATTERN.test(raw)) {
    const slug = raw.toLowerCase();
    if (CDN_BLOCKED_SLUGS.has(slug)) {
      return { kind: "image", src: iconifyUrl("simple-icons", slug), fallback: GENERIC_ICON };
    }
    return {
      kind: "image",
      src: simpleIconsUrl(slug),
      fallback: iconifyUrl("simple-icons", slug),
    };
  }

  // 5. Anything else (emoji, symbol, letter) is drawn as text.
  return { kind: "text", text: raw };
}

/**
 * Best-effort accessible name for a link that has no visible label.
 * Uses the icon slug when available, otherwise the URL hostname.
 */
export function accessibleLinkName(link: {
  label?: string;
  url?: string;
  icon?: string;
}): string {
  const label = (link.label ?? "").trim();
  if (label) return label;

  const icon = (link.icon ?? "").trim();
  if (icon && !/^https?:\/\//i.test(icon)) {
    const tail = icon.split(":").pop() ?? icon;
    const slug = tail.split("/").filter(Boolean).pop();
    if (slug && SLUG_PATTERN.test(slug)) return slug.replace(/[-_]+/g, " ");
  }

  const url = (link.url ?? "").trim();
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }
  return "Link";
}
