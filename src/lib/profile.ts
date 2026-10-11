/**
 * Maps the raw `profile.json` content onto the component contract.
 *
 * Everything is validated at runtime: a missing or malformed field degrades to
 * a safe default instead of crashing the whole page. Unknown style values are
 * resolved by `ProfileCard` (glass / rounded / circle / lg / JetBrains Mono).
 *
 * Imports stay inside `src/lib` on purpose: `vite.config.ts` imports this module
 * to bake the SEO tags, so it must not reach a `.tsx` file.
 */

import type {
  DiscordPresence,
  ProfileBadge,
  ProfileLink,
  ProfileMedia,
  ProfileView,
} from "./profileTypes";

export const DEFAULT_ACCENT = "#8ab4ff";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeBadges(value: unknown): ProfileBadge[] {
  if (!Array.isArray(value)) return [];

  const badges: ProfileBadge[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const label = str(entry.label).trim();
    if (!label) continue;
    const color = str(entry.color).trim() || DEFAULT_ACCENT;
    badges.push({ label, color });
  }
  return badges;
}

function normalizeLinks(value: unknown): ProfileLink[] {
  if (!Array.isArray(value)) return [];

  const links: ProfileLink[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const url = str(entry.url).trim();
    if (!url) continue;
    links.push({ label: str(entry.label), url, icon: str(entry.icon) });
  }
  return links;
}

function normalizePresence(value: unknown): DiscordPresence | undefined {
  if (!isRecord(value)) return undefined;
  const username = str(value.username).trim();
  if (!username) return undefined;

  return {
    username,
    activity: str(value.activity),
    status: str(value.status, "offline") || "offline",
    avatarUrl: str(value.avatarUrl),
  };
}

export function buildProfileView(raw: unknown): ProfileView {
  const root = isRecord(raw) ? raw : {};
  const identity = isRecord(root.identity) ? root.identity : {};
  const theme = isRecord(root.theme) ? root.theme : {};
  const media = isRecord(root.media) ? root.media : {};

  return {
    uid: num(identity.uid, 0),
    displayName: str(identity.handle).trim() || "anonymous",
    title: str(identity.title),
    bio: str(identity.bio),
    avatarUrl: str(media.avatarUrl).trim(),
    bannerUrl: str(media.bannerUrl).trim(),
    accent: str(theme.accent).trim() || DEFAULT_ACCENT,
    cardStyle: str(theme.cardStyle, "glass").trim() || "glass",
    cardShape: str(theme.cardShape, "rounded").trim() || "rounded",
    nameEffect: str(theme.nameEffect, "shimmer").trim() || "shimmer",
    avatarShape: str(theme.avatarShape, "circle").trim() || "circle",
    avatarSize: str(theme.avatarSize, "lg").trim() || "lg",
    font: str(theme.font, "jetbrains").trim() || "jetbrains",
    buttonTheme: str(theme.buttonTheme, "glass").trim() || "glass",
    badges: normalizeBadges(root.badges),
    links: normalizeLinks(root.links),
    discord: normalizePresence(root.presence),
  };
}

export function readMedia(raw: unknown): ProfileMedia {
  const root = isRecord(raw) ? raw : {};
  const media = isRecord(root.media) ? root.media : {};

  return {
    avatarUrl: str(media.avatarUrl).trim(),
    bannerUrl: str(media.bannerUrl).trim(),
    backgroundVideoUrl: str(media.backgroundVideoUrl).trim(),
    musicUrl: str(media.musicUrl).trim(),
  };
}
