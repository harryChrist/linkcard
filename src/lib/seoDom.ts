/**
 * The DOM half of the SEO document: `seo.ts` builds it, this applies it.
 *
 * Kept apart on purpose. The builder is imported by `vite.config.ts` (a Node
 * context with no DOM lib), and keeping browser globals out of its import graph
 * means build tooling can never silently depend on them.
 */

import { JSON_LD_ATTR, JSON_LD_SELECTOR, type SeoDocument, type SeoTag } from "./seo";

function tagSelector(tag: SeoTag): string {
  if (tag.kind === "link") return `link[rel="${tag.attrs.rel}"]`;

  // Selectors only ever use fixed keys, never profile values, so no escaping.
  const key = "name" in tag.attrs ? "name" : "property";
  return `meta[${key}="${tag.attrs[key]}"]`;
}

/**
 * Writes the document into a live DOM, updating the tags baked into
 * `index.html` in place instead of appending duplicates. Re-running is a no-op,
 * so StrictMode's double effect is harmless.
 */
export function applySeo(seo: SeoDocument, doc: Document): void {
  doc.title = seo.title;
  doc.documentElement.lang = seo.lang;

  for (const tag of seo.tags) {
    const existing = doc.head.querySelector(tagSelector(tag));
    const element = existing ?? doc.createElement(tag.kind);
    for (const [name, value] of Object.entries(tag.attrs)) element.setAttribute(name, value);
    if (!existing) doc.head.appendChild(element);
  }

  const existingScript = doc.head.querySelector(JSON_LD_SELECTOR);
  if (existingScript) {
    existingScript.textContent = seo.jsonLd;
    return;
  }

  const script = doc.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute(JSON_LD_ATTR, "json-ld");
  script.textContent = seo.jsonLd;
  doc.head.appendChild(script);
}
