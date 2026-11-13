import { Volume2, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";

import type { SoundDockPosition } from "@/lib/profileTypes";
import { cn } from "@/lib/utils";

/** Fixed-position classes per corner, padded away from notches and home bars. */
const POSITION_CLASSES: Record<SoundDockPosition, string> = {
  "top-right": "top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]",
  "top-left": "top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]",
  "bottom-right":
    "bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]",
  "bottom-left":
    "bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]",
};

export type SoundDockProps = {
  /** Accent colour used for the slider fill. */
  accent: string;
  /** Screen corner the dock is pinned to. Defaults to bottom-right. */
  position?: SoundDockPosition;
  muted: boolean;
  /** Normalised integer volume, 0–100. */
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (next: number) => void;
};

/**
 * Fixed audio control pinned to a screen corner. Marked with `data-sound-dock`
 * so the global "first gesture enables sound" listener can ignore interactions
 * that happen inside it.
 */
export function SoundDock({
  accent,
  position = "bottom-right",
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
}: SoundDockProps) {
  const safeVolume = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : 0;
  const label = muted ? "Enable sound" : "Mute sound";

  return (
    <div
      data-sound-dock
      style={
        {
          "--profile-volume-accent": accent,
          "--profile-volume-fill": `${safeVolume}%`,
        } as CSSProperties
      }
      data-position={position}
      className={cn(
        "sound-dock fixed z-50 flex items-center gap-2 rounded-full py-2 pl-2 pr-3",
        POSITION_CLASSES[position],
      )}
    >
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={label}
        title={label}
        aria-pressed={!muted}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full transition-colors",
          "hover:bg-white/10 focus-visible:bg-white/10",
          muted ? "text-[#f2a2a2]" : "text-foreground",
        )}
      >
        {muted ? (
          <VolumeX
            aria-hidden="true"
            className="h-[1.05rem] w-[1.05rem] motion-safe:animate-mute-pulse"
          />
        ) : (
          <Volume2 aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={safeVolume}
        aria-label="Volume"
        aria-valuetext={`${safeVolume}%`}
        title="Volume"
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        className="sound-slider"
      />

      {/*
       * Fixed width and tabular digits: the dock must not shift when the value
       * goes from 7% to 100%. Hidden from assistive tech because the range
       * input above already exposes the same number through `aria-valuetext`.
       */}
      <span
        aria-hidden="true"
        data-volume-readout
        className={cn(
          "w-9 shrink-0 text-right text-[0.6875rem] leading-none tabular-nums transition-colors",
          muted ? "text-[#f2a2a2]" : "text-foreground",
        )}
      >
        {safeVolume}%
      </span>
    </div>
  );
}
