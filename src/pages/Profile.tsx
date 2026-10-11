import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

import { ProfileCard } from "@/components/profile/ProfileCard";
import { SoundDock } from "@/components/profile/SoundDock";
import { buildProfileView, readMedia } from "@/lib/profile";
import { buildSeo } from "@/lib/seo";
import { applySeo } from "@/lib/seoDom";
import {
  buildYouTubeEmbedUrl,
  isYouTubeUrl,
  parseYouTubeId,
  postYouTubeCaptionSuppression,
  postYouTubeCommand,
  postYouTubeListening,
  readYouTubeMessage,
} from "@/lib/youtube";
import profileData from "@/profile.json";

const DEFAULT_VOLUME = 70;
/** How often we ask the YouTube player for its position (keeps refs fresh). */
const TIME_POLL_MS = 1000;

const clampVolume = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** `play()` rejects when autoplay is blocked; that must never break the page. */
function safePlay(element: HTMLMediaElement | null) {
  if (!element) return;
  try {
    const result = element.play();
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // Older browsers throw synchronously instead of rejecting.
  }
}

/* ------------------------------------------------------------------ *
 * Direct video (<video>) background
 * ------------------------------------------------------------------ */

type VideoBackgroundProps = {
  src: string;
  poster: string;
  muted: boolean;
  volume: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  mutedRef: RefObject<boolean>;
  volumeRef: RefObject<number>;
  playbackTimeRef: RefObject<number>;
};

function VideoBackground({
  src,
  poster,
  muted,
  volume,
  videoRef,
  mutedRef,
  volumeRef,
  playbackTimeRef,
}: VideoBackgroundProps) {
  /**
   * Re-applies position and sound to a freshly mounted element. The shared
   * `playbackTimeRef` lives in `Profile`, so any remount (StrictMode, source
   * change) resumes instead of restarting.
   */
  const restorePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const time = playbackTimeRef.current;
    const duration = video.duration;
    const durationKnown = Number.isFinite(duration) && duration > 0;

    if (Number.isFinite(time) && time > 0 && (!durationKnown || time < duration)) {
      try {
        video.currentTime = time;
      } catch {
        // Seeking before metadata is available throws in some browsers.
      }
    }

    video.volume = clampVolume(volumeRef.current) / 100;
    video.muted = mutedRef.current;
    if (!mutedRef.current) safePlay(video);
  }, [mutedRef, playbackTimeRef, videoRef, volumeRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // `src` is in the deps: a source change remounts playback state too.
    if (video.readyState >= 1) {
      restorePlayback();
      return;
    }

    const handleMetadata = () => restorePlayback();
    video.addEventListener("loadedmetadata", handleMetadata, { once: true });
    return () => video.removeEventListener("loadedmetadata", handleMetadata);
  }, [restorePlayback, src, videoRef]);

  // Live mute/volume edits, without touching playback position.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = clampVolume(volume) / 100;
    if (!muted) safePlay(video);
  }, [muted, videoRef, volume]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      autoPlay
      muted={muted}
      loop
      playsInline
      preload="auto"
      onTimeUpdate={(event) => {
        playbackTimeRef.current = event.currentTarget.currentTime;
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/* ------------------------------------------------------------------ *
 * YouTube iframe background
 * ------------------------------------------------------------------ */

type YouTubeBackgroundProps = {
  videoId: string;
  muted: boolean;
  volume: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  mutedRef: RefObject<boolean>;
  volumeRef: RefObject<number>;
  playbackTimeRef: RefObject<number>;
};

function YouTubeBackground({
  videoId,
  muted,
  volume,
  iframeRef,
  mutedRef,
  volumeRef,
  playbackTimeRef,
}: YouTubeBackgroundProps) {
  const src = useMemo(() => buildYouTubeEmbedUrl(videoId), [videoId]);

  /**
   * Position to resume, frozen when this player instance mounts. A brand new
   * iframe reports `currentTime: 0` right away, so the shared ref must not be
   * overwritten until the player actually caught up.
   */
  const resumeTimeRef = useRef(0);
  const appliedRef = useRef(false);
  const seekAttemptsRef = useRef(0);
  /** How many times the caption layer has been switched off since mount. */
  const captionAttemptsRef = useRef(0);

  // Capture happens in an effect (never during render) and before the message
  // listener below is registered, so the first player payload already sees it.
  useEffect(() => {
    resumeTimeRef.current = playbackTimeRef.current;
    appliedRef.current = false;
    seekAttemptsRef.current = 0;
    captionAttemptsRef.current = 0;
  }, [playbackTimeRef, src]);

  /** Pushes play/mute/volume, removes the caption modules and seeks. */
  const applyState = useCallback(
    (seek: boolean) => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;

      postYouTubeListening(target);
      postYouTubeCommand(target, "playVideo");
      postYouTubeCommand(target, mutedRef.current ? "mute" : "unMute");
      postYouTubeCommand(target, "setVolume", [clampVolume(volumeRef.current)]);
      // Belt and braces with `cc_load_policy=0`: the player can still pick an
      // auto-generated caption track, so the modules are unloaded and the
      // track cleared explicitly.
      postYouTubeCaptionSuppression(target);
      captionAttemptsRef.current += 1;

      const time = resumeTimeRef.current;
      if (seek && Number.isFinite(time) && time > 1) {
        postYouTubeCommand(target, "seekTo", [time, true]);
      }
    },
    [iframeRef, mutedRef, volumeRef],
  );

  // Player events. Validation is strict: the message must come from this
  // iframe's window and a YouTube origin. The first payload is proof that the
  // command channel is live — a bare embed created without the JS API bootstrap
  // does not reliably emit `onReady`, so commands sent from a `load` handler
  // can be dropped. Anything not acknowledged is retried a few times.
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (!event.origin.startsWith("https://www.youtube")) return;

      const message = readYouTubeMessage(event.data);
      if (!message) return;

      const currentTime = message.info.currentTime;
      const hasTime = typeof currentTime === "number" && Number.isFinite(currentTime);

      if (!hasTime) {
        if (!appliedRef.current && message.event === "onReady") {
          appliedRef.current = true;
          applyState(true);
        }
        return;
      }

      if (!appliedRef.current) {
        appliedRef.current = true;
        applyState(true);
      }

      // Captions can be attached once playback starts, so the suppression is
      // re-sent a few times while the player reports progress. `playerState`
      // is not part of these payloads, the advancing currentTime is.
      if (captionAttemptsRef.current < 4) {
        captionAttemptsRef.current += 1;
        postYouTubeCaptionSuppression(iframeRef.current?.contentWindow);
      }

      const target = resumeTimeRef.current;
      if (target > 1 && currentTime < target - 2 && seekAttemptsRef.current < 4) {
        seekAttemptsRef.current += 1;
        const source = iframeRef.current?.contentWindow;
        if (source) postYouTubeCommand(source, "seekTo", [target, true]);
        return;
      }

      // Tracking resumes once the player caught up (or stopped retrying).
      playbackTimeRef.current = currentTime;
    };

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [applyState, iframeRef, playbackTimeRef]);

  // Ask for the position periodically (and once before unmounting) so a
  // remount can resume within ~1s. This is the best the iframe API allows
  // without owning the player object.
  useEffect(() => {
    const request = () => {
      const target = iframeRef.current?.contentWindow;
      if (target) postYouTubeCommand(target, "getCurrentTime");
    };

    const interval = window.setInterval(request, TIME_POLL_MS);
    return () => {
      window.clearInterval(interval);
      request();
    };
  }, [iframeRef]);

  // Handshake: apply the current state as soon as the frame loads, and once
  // immediately in case the load event already fired.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    applyState(true);
    const handle = () => applyState(true);
    iframe.addEventListener("load", handle);
    return () => iframe.removeEventListener("load", handle);
  }, [applyState, iframeRef, src]);

  useEffect(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    postYouTubeCommand(target, muted ? "mute" : "unMute");
    postYouTubeCommand(target, "setVolume", [clampVolume(volume)]);
  }, [iframeRef, muted, volume]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Background video"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      tabIndex={-1}
      aria-hidden="true"
      className="layer-iframe-cover"
    />
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function Profile() {
  const profile = useMemo(() => buildProfileView(profileData), []);
  const media = useMemo(() => readMedia(profileData), []);
  const seo = useMemo(() => buildSeo(profileData), []);

  // Keeps the tab title, the meta tags and the favicon in sync with the profile
  // while the dev server runs. The build bakes the same document into
  // index.html, which is what crawlers and link unfurlers read.
  useEffect(() => {
    applySeo(seo, document);
  }, [seo]);

  const youtubeId = useMemo(
    () => parseYouTubeId(media.backgroundVideoUrl),
    [media.backgroundVideoUrl],
  );

  // A YouTube link that failed to parse is ignored rather than treated as a file.
  const videoUrl = useMemo(() => {
    if (!media.backgroundVideoUrl || youtubeId) return "";
    return isYouTubeUrl(media.backgroundVideoUrl) ? "" : media.backgroundVideoUrl;
  }, [media.backgroundVideoUrl, youtubeId]);

  const hasBackground = Boolean(youtubeId || videoUrl);
  const hasMusic = Boolean(media.musicUrl);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Shared across player instances so resizing never restarts playback. */
  const playbackTimeRef = useRef(0);

  // Browsers block autoplay with audio, so we always start muted.
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // A separate music track owns the sound; the background video stays muted.
  const backgroundMuted = hasMusic ? true : muted;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = muted;
    audio.volume = clampVolume(volume) / 100;
    if (muted) {
      audio.pause();
    } else {
      safePlay(audio);
    }
  }, [muted, volume]);

  // First gesture anywhere outside the sound dock enables sound.
  useEffect(() => {
    if (!muted) return;

    const handleGesture = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-sound-dock]")) return;
      setMuted(false);
    };

    const options: AddEventListenerOptions = { capture: true };
    window.addEventListener("pointerdown", handleGesture, options);
    window.addEventListener("touchstart", handleGesture, options);
    window.addEventListener("keydown", handleGesture, options);

    return () => {
      window.removeEventListener("pointerdown", handleGesture, options);
      window.removeEventListener("touchstart", handleGesture, options);
      window.removeEventListener("keydown", handleGesture, options);
    };
  }, [muted]);

  const handleToggleMute = () => setMuted((current) => !current);

  const handleVolumeChange = (next: number) => {
    const value = clampVolume(next);
    setVolume(value);
    if (value > 0) setMuted(false);
  };

  /** The single background player instance mounted by the page. */
  const renderPlayer = () => {
    if (youtubeId) {
      return (
        <YouTubeBackground
          videoId={youtubeId}
          muted={backgroundMuted}
          volume={volume}
          iframeRef={iframeRef}
          mutedRef={mutedRef}
          volumeRef={volumeRef}
          playbackTimeRef={playbackTimeRef}
        />
      );
    }

    if (videoUrl) {
      return (
        <VideoBackground
          src={videoUrl}
          poster={media.bannerUrl}
          muted={backgroundMuted}
          volume={volume}
          videoRef={videoRef}
          mutedRef={mutedRef}
          volumeRef={volumeRef}
          playbackTimeRef={playbackTimeRef}
        />
      );
    }

    return null;
  };

  return (
    <main className="relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {hasBackground ? (
        <div
          aria-hidden="true"
          style={{ "--profile-accent": profile.accent } as CSSProperties}
          className="fixed inset-0 z-0 overflow-hidden bg-black"
        >
          {renderPlayer()}
          <div className="layer-scrim absolute inset-0" />
        </div>
      ) : null}

      <div className="relative z-10 w-full flex justify-center">
        <ProfileCard profile={profile} />
      </div>

      {hasMusic ? (
        <audio ref={audioRef} src={media.musicUrl} loop preload="none" className="hidden" />
      ) : null}

      <SoundDock
        accent={profile.accent}
        muted={muted}
        volume={volume}
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
      />
    </main>
  );
}
