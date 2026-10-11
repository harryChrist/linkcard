/**
 * YouTube URL parsing and embed URL building for the background player.
 * Pure functions: safe to call with anything from `profile.json`.
 */

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
]);

/** Path segments that are followed by a video id. */
const KEYED_SEGMENTS = new Set(["embed", "shorts", "live", "v", "e"]);

/**
 * Extracts the 11-character video id from a YouTube URL.
 * Supports `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, bare-host and
 * protocol-relative URLs. Returns `null` for anything else (including other
 * hosts and malformed input) instead of throwing.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const queryId = url.searchParams.get("v");
  if (queryId && YOUTUBE_ID_PATTERN.test(queryId)) return queryId;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && KEYED_SEGMENTS.has(segments[0].toLowerCase())) {
    const id = segments[1];
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  return null;
}

export type YouTubeEmbedOptions = {
  /** Sent to the player as `origin`; falls back to `window.location.origin`. */
  origin?: string;
};

const YOUTUBE_EMBED_QUERY = {
  autoplay: "1",
  mute: "1",
  loop: "1",
  controls: "0",
  modestbranding: "1",
  rel: "0",
  iv_load_policy: "3",
  // Never force a caption track on: the background video must stay clean.
  cc_load_policy: "0",
  fs: "0",
  playsinline: "1",
  enablejsapi: "1",
} as const;

/**
 * Player modules that would draw over the background video. `captions` is the
 * current name, `cc` the legacy one; unloading an unknown module is a no-op.
 */
export const YOUTUBE_MODULES_TO_UNLOAD = ["captions", "cc"] as const;

/**
 * Commands that switch the caption layer off. `cc_load_policy=0` only sets the
 * initial preference and does not override the track the player may pick for
 * an auto-generated (ASR) caption, so the module is removed and the track is
 * cleared explicitly through the same command channel.
 */
export const YOUTUBE_CAPTION_SUPPRESSIONS: ReadonlyArray<{
  func: string;
  args: unknown[];
}> = [
  { func: "unloadModule", args: ["captions"] },
  { func: "unloadModule", args: ["cc"] },
  { func: "setOption", args: ["captions", "track", {}] },
];

/** Builds the privacy-friendly embed URL used by the background player. */
export function buildYouTubeEmbedUrl(
  videoId: string,
  options: YouTubeEmbedOptions = {},
): string {
  const params = new URLSearchParams({ ...YOUTUBE_EMBED_QUERY, playlist: videoId });

  const origin =
    options.origin ??
    (typeof window !== "undefined" && window.location ? window.location.origin : "");
  if (origin && origin !== "null") params.set("origin", origin);

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/* ------------------------------------------------------------------ *
 * IFrame Player API postMessage helpers
 * ------------------------------------------------------------------ */

type PostTarget = { postMessage: (message: string, targetOrigin: string) => void } | null | undefined;

/** Sends a command to an `enablejsapi=1` YouTube iframe. */
export function postYouTubeCommand(
  target: PostTarget,
  func: string,
  args: unknown[] = [],
): void {
  if (!target) return;
  try {
    target.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  } catch {
    // The iframe may already be detached; nothing to recover from.
  }
}

/** Removes a player module (captions/annotations) from the embed. */
export function postYouTubeUnloadModules(
  target: PostTarget,
  modules: readonly string[] = YOUTUBE_MODULES_TO_UNLOAD,
): void {
  for (const moduleName of modules) {
    postYouTubeCommand(target, "unloadModule", [moduleName]);
  }
}

/**
 * Turns the caption layer off through every command the player accepts:
 * unloads the modules and clears the selected track.
 */
export function postYouTubeCaptionSuppression(
  target: PostTarget,
  commands: ReadonlyArray<{ func: string; args: unknown[] }> = YOUTUBE_CAPTION_SUPPRESSIONS,
): void {
  for (const { func, args } of commands) {
    postYouTubeCommand(target, func, args);
  }
}

/** Opens the command channel so the player starts reporting its state. */
export function postYouTubeListening(target: PostTarget, id = 1): void {
  if (!target) return;
  try {
    target.postMessage(JSON.stringify({ event: "listening", id, channel: "widget" }), "*");
  } catch {
    // Ignore detached iframes.
  }
}

/**
 * Normalises an incoming YouTube iframe message. The player sends either a JSON
 * string or a plain object depending on the API version, so both are accepted
 * and anything unrecognised returns `null`.
 */
export function readYouTubeMessage(
  data: unknown,
): { event: string; info: Record<string, unknown> } | null {
  let payload: unknown = data;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (typeof payload !== "object" || payload === null) return null;

  const record = payload as Record<string, unknown>;
  const event = typeof record.event === "string" ? record.event : "";
  if (!event) return null;

  const info = typeof record.info === "object" && record.info !== null
    ? (record.info as Record<string, unknown>)
    : {};

  return { event, info };
}

/**
 * True when the value looks like a YouTube URL (even an invalid one). Used to
 * decide between the iframe player and a direct `<video>` element.
 */
export function isYouTubeUrl(input: string | null | undefined): boolean {
  const raw = (input ?? "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtu.be" || YOUTUBE_HOSTS.has(host);
  } catch {
    return false;
  }
}
