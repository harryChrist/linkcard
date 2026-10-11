import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { buildSeo, renderSeoTags, SEO_END, SEO_START, type SeoDocument } from "./src/lib/seo";

const PROFILE_PATH = fileURLToPath(new URL("./src/profile.json", import.meta.url));

/** Rewrites the `lang` attribute of the opening `<html>` tag. */
function withLang(html: string, lang: string): string {
  return html.replace(/<html\b[^>]*>/i, (tag) =>
    /\slang=/i.test(tag)
      ? tag.replace(/\slang="[^"]*"/i, ` lang="${lang}"`)
      : tag.replace(/^<html/i, `<html lang="${lang}"`),
  );
}

/**
 * Bakes the title, meta tags and JSON-LD derived from `src/profile.json` into
 * `index.html`, for the dev server and the build alike.
 *
 * Build time is the only place that works for link unfurlers (Discord, Slack,
 * X) and most crawlers: they read the served HTML and never run the bundle.
 * The JSON is read on every transform, so an edit lands on the next reload, and
 * `Profile.tsx` re-applies the same values to the live DOM.
 */
function linkcardSeo(): Plugin {
  return {
    name: "linkcard-seo",
    transformIndexHtml(html) {
      const start = html.indexOf(SEO_START);
      const end = html.indexOf(SEO_END);
      if (start === -1 || end === -1) return html;

      let seo: SeoDocument;
      try {
        seo = buildSeo(JSON.parse(readFileSync(PROFILE_PATH, "utf8")) as unknown);
      } catch (error) {
        console.warn(
          `[linkcard-seo] could not read src/profile.json, keeping the head as written: ${String(error)}`,
        );
        return html;
      }

      const eol = html.includes("\r\n") ? "\r\n" : "\n";
      const block = renderSeoTags(seo, eol)
        .split(eol)
        .map((line) => (line ? `    ${line}` : line))
        .join(eol);

      const replaced = [SEO_START, block, `    ${SEO_END}`].join(eol);
      return withLang(html.slice(0, start) + replaced + html.slice(end + SEO_END.length), seo.lang);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), linkcardSeo()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
  },
  build: {
    sourcemap: false,
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
