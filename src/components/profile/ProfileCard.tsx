import { Link2 } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import type {
  DiscordPresence,
  ProfileBadge,
  ProfileLink,
  ProfileView,
} from "@/lib/profileTypes";
import { accessibleLinkName, iconSource } from "@/lib/iconSource";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Types — defined in `@/lib/profileTypes` and re-exported here so the
 * component keeps its public surface for editors and other consumers.
 * ------------------------------------------------------------------ */
export type { DiscordPresence, ProfileBadge, ProfileLink, ProfileView };

export type ProfileCardProps = {
  profile: ProfileView;
  /**
   * Optional background player for the banner. The page keeps the video as a
   * fixed full-screen background only, so it renders the static banner image;
   * this stays available for consumers that want a video header.
   */
  bannerVideo?: ReactNode;
  /** Banner aspect ratio when a video is passed. Defaults to 16/9. */
  bannerAspectRatio?: number;
  className?: string;
};

/* ------------------------------------------------------------------ *
 * Catalogs (exported for reuse by editors/tooling)
 * ------------------------------------------------------------------ */
export const CARD_STYLES = ["glass", "solid", "outline", "neon"] as const;
export const NAME_EFFECTS = [
  "none",
  "glow",
  "gradient",
  "rainbow",
  "shimmer",
  "typewriter",
] as const;
export const CARD_SHAPES = {
  rounded: "26px",
  soft: "36px",
  square: "12px",
} as const;
export const BUTTON_THEMES = ["glass", "solid", "outline", "sharp", "pill"] as const;
export const AVATAR_SHAPES = ["circle", "squircle", "square"] as const;
export const AVATAR_SIZES = { sm: 72, md: 84, lg: 96, xl: 112 } as const;
export const FONTS = [
  { id: "jetbrains", label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: "manrope", label: "Manrope", stack: "'Manrope', system-ui, -apple-system, sans-serif" },
  { id: "inter", label: "Inter", stack: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: "jakarta", label: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "poppins", label: "Poppins", stack: "'Poppins', system-ui, sans-serif" },
  { id: "montserrat", label: "Montserrat", stack: "'Montserrat', system-ui, sans-serif" },
  { id: "oswald", label: "Oswald", stack: "'Oswald', system-ui, sans-serif" },
  { id: "raleway", label: "Raleway", stack: "'Raleway', system-ui, sans-serif" },
  { id: "rubik", label: "Rubik", stack: "'Rubik', system-ui, sans-serif" },
  { id: "nunito", label: "Nunito", stack: "'Nunito', system-ui, sans-serif" },
  { id: "grotesk", label: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif" },
  { id: "bebas", label: "Bebas Neue", stack: "'Bebas Neue', system-ui, sans-serif" },
  { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
] as const;

/* ------------------------------------------------------------------ *
 * Safe resolution — unknown values fall back to the defaults below
 * (glass / rounded / circle / lg / JetBrains Mono) without crashing.
 * ------------------------------------------------------------------ */
type ShapeKey = keyof typeof CARD_SHAPES;
type SizeKey = keyof typeof AVATAR_SIZES;

const isKeyOf = <T extends Record<string, unknown>>(catalog: T, value: string): value is string & keyof T =>
  Object.prototype.hasOwnProperty.call(catalog, value);

export function resolveCardStyle(value: string): (typeof CARD_STYLES)[number] {
  return (CARD_STYLES as readonly string[]).includes(value)
    ? (value as (typeof CARD_STYLES)[number])
    : "glass";
}

export function resolveNameEffect(value: string): (typeof NAME_EFFECTS)[number] {
  return (NAME_EFFECTS as readonly string[]).includes(value)
    ? (value as (typeof NAME_EFFECTS)[number])
    : "shimmer";
}

export function resolveCardShape(value: string): ShapeKey {
  return isKeyOf(CARD_SHAPES, value) ? value : "rounded";
}

export function resolveButtonTheme(value: string): (typeof BUTTON_THEMES)[number] {
  return (BUTTON_THEMES as readonly string[]).includes(value)
    ? (value as (typeof BUTTON_THEMES)[number])
    : "glass";
}

export function resolveAvatarShape(value: string): (typeof AVATAR_SHAPES)[number] {
  return (AVATAR_SHAPES as readonly string[]).includes(value)
    ? (value as (typeof AVATAR_SHAPES)[number])
    : "circle";
}

export function resolveAvatarSize(value: string): SizeKey {
  return isKeyOf(AVATAR_SIZES, value) ? value : "lg";
}

export function resolveFont(value: string) {
  return FONTS.find((font) => font.id === value) ?? FONTS[0];
}

export const NAME_EFFECT_CLASSES: Record<(typeof NAME_EFFECTS)[number], string> = {
  none: "",
  glow: "name-glow",
  gradient: "name-gradient",
  rainbow: "name-rainbow",
  shimmer: "name-shimmer",
  typewriter: "name-typewriter",
};

const CARD_STYLE_CLASSES: Record<(typeof CARD_STYLES)[number], string> = {
  glass: "card-glass",
  solid: "card-solid",
  outline: "card-outline",
  neon: "card-neon",
};

const BUTTON_THEME_CLASSES: Record<(typeof BUTTON_THEMES)[number], string> = {
  glass: "btn-glass",
  solid: "btn-solid",
  outline: "btn-outline",
  sharp: "btn-sharp btn-glass",
  pill: "btn-pill btn-glass",
};

const AVATAR_SHAPE_CLASSES: Record<(typeof AVATAR_SHAPES)[number], string> = {
  circle: "rounded-full",
  squircle: "rounded-[42%]",
  square: "rounded-xl",
};

const STATUS_COLORS: Record<string, string> = {
  online: "#3ba55d",
  idle: "#faa61a",
  dnd: "#ed4245",
  offline: "#747f8d",
};

export function normalizeStatus(status: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_COLORS, status) ? status : "offline";
}

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

/**
 * Renders a link icon with a single, bounded fallback chain:
 * source -> fallback source -> neutral functional glyph.
 */
function LinkGlyph({ icon }: { icon: string }) {
  const [step, setStep] = useState(0);

  const source = iconSource(icon);
  if (!source) return null;

  if (source.kind === "text") {
    return (
      <span aria-hidden="true" className="text-[1.05rem] leading-none">
        {source.text}
      </span>
    );
  }

  const src = step === 0 ? source.src : step === 1 ? source.fallback : undefined;

  if (!src) {
    return <Link2 aria-hidden="true" className="h-4 w-4 shrink-0 opacity-80" />;
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setStep((current) => (current < 2 ? current + 1 : current))}
      className="h-4 w-4 shrink-0 object-contain"
    />
  );
}

function BadgePill({ label, color }: ProfileBadge) {
  return (
    <span
      style={{ backgroundColor: color, borderColor: color }}
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-[#0b0d12]"
    >
      {label}
    </span>
  );
}

function PresenceBox({ presence }: { presence: DiscordPresence }) {
  const status = normalizeStatus(presence.status);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 text-left">
      <span className="relative inline-flex h-10 w-10 shrink-0">
        {presence.avatarUrl ? (
          <img
            src={presence.avatarUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="h-10 w-10 rounded-full bg-white/10" />
        )}
        <span
          aria-hidden="true"
          style={{ backgroundColor: STATUS_COLORS[status] }}
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0e13]"
        />
        <span className="sr-only">{status}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
          {presence.username}
        </span>
        <span className="block truncate text-[0.6875rem] text-muted-foreground">
          {presence.activity}
        </span>
      </span>
    </div>
  );
}

function LinkButton({
  link,
  themeClass,
}: {
  link: ProfileLink;
  themeClass: string;
}) {
  const hasLabel = Boolean(link.label?.trim());

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleLinkName(link)}
      title={hasLabel ? undefined : accessibleLinkName(link)}
      className={cn(
        "profile-link",
        themeClass,
        hasLabel
          ? "flex-1 basis-[calc(50%-0.25rem)] min-w-[42%] text-foreground"
          : "w-12 flex-none",
      )}
    >
      <span aria-hidden="true" className="link-sheen" />
      <LinkGlyph icon={link.icon} />
      {hasLabel ? <span className="truncate">{link.label}</span> : null}
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * ProfileCard
 * ------------------------------------------------------------------ */
export function ProfileCard({
  profile,
  bannerVideo,
  bannerAspectRatio = 16 / 9,
  className,
}: ProfileCardProps) {
  const cardStyle = resolveCardStyle(profile.cardStyle);
  const cardShape = resolveCardShape(profile.cardShape);
  const nameEffect = resolveNameEffect(profile.nameEffect);
  const avatarShape = resolveAvatarShape(profile.avatarShape);
  const avatarSizeKey = resolveAvatarSize(profile.avatarSize);
  const buttonTheme = resolveButtonTheme(profile.buttonTheme);
  const font = resolveFont(profile.font);

  const avatarSize = AVATAR_SIZES[avatarSizeKey];
  const accent = profile.accent?.trim() || "#8ab4ff";

  const badges = (profile.badges ?? []).filter((badge) => Boolean(badge?.label?.trim()));
  const links = (profile.links ?? []).filter((link) => Boolean(link?.url?.trim()));

  const name = `@${profile.displayName}`;
  const uidLabel = Number.isFinite(profile.uid) ? `#${profile.uid}` : "";

  const cardStyleVars = {
    "--profile-accent": accent,
    borderRadius: CARD_SHAPES[cardShape],
    fontFamily: font.stack,
    ...(nameEffect === "typewriter" ? { "--name-length": name.length } : {}),
  } as CSSProperties;

  return (
    <section
      style={cardStyleVars}
      className={cn(
        "profile-card relative w-full max-w-[450px] overflow-hidden animate-card-in",
        CARD_STYLE_CLASSES[cardStyle],
        className,
      )}
    >
      {/* Banner ---------------------------------------------------- */}
      <div
        className={cn(
          "relative z-[1] w-full overflow-hidden bg-black",
          bannerVideo ? "" : "h-[138px]",
        )}
        style={bannerVideo ? { aspectRatio: String(bannerAspectRatio) } : undefined}
      >
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {bannerVideo}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/70"
        />
      </div>

      {/* Content --------------------------------------------------- */}
      <div className="relative z-[2] px-6 pb-7 text-center">
        <div className="flex justify-center" style={{ marginTop: -(avatarSize / 2) }}>
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            width={avatarSize}
            height={avatarSize}
            style={{ width: avatarSize, height: avatarSize }}
            className={cn(
              "border-[3px] border-[#0b0e13] object-cover shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)] animate-fade-up",
              AVATAR_SHAPE_CLASSES[avatarShape],
            )}
          />
        </div>

        <div
          className="mt-3 flex flex-col items-center"
          title={uidLabel || undefined}
        >
          <h1
            tabIndex={uidLabel ? 0 : undefined}
            className={cn(
              "profile-name text-[1.4rem] font-bold tracking-[-0.02em] break-words",
              NAME_EFFECT_CLASSES[nameEffect],
            )}
          >
            {name}
          </h1>
          {uidLabel ? <span className="sr-only">UID {uidLabel}</span> : null}
        </div>

        {badges.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {badges.map((badge) => (
              <BadgePill key={badge.label} label={badge.label} color={badge.color} />
            ))}
          </div>
        ) : null}

        {profile.title?.trim() ? (
          <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {profile.title}
          </p>
        ) : null}

        <div aria-hidden="true" className="mx-auto mt-4 h-px w-14" style={{ backgroundColor: accent }} />

        {profile.bio?.trim() ? (
          <p className="mx-auto mt-4 max-w-[36ch] text-[0.8125rem] leading-relaxed text-white/70 break-words">
            {profile.bio}
          </p>
        ) : null}

        {profile.discord?.username?.trim() ? (
          <div className="mt-5">
            <PresenceBox presence={profile.discord} />
          </div>
        ) : null}

        {links.length > 0 ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {links.map((link, index) => (
              <LinkButton
                key={`${link.url}-${index}`}
                link={link}
                themeClass={BUTTON_THEME_CLASSES[buttonTheme]}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
