/**
 * The shape of a profile: what `profile.json` becomes after validation.
 *
 * These types live outside both the component that renders them and the module
 * that builds them, so neither has to import the other. That matters at build
 * time: `vite.config.ts` runs in a Node context and imports `profile.ts`, which
 * must therefore never pull in a `.tsx` file.
 */

export type ProfileBadge = { label: string; color: string };

export type ProfileLink = { label: string; url: string; icon: string };

export type DiscordPresence = {
  username: string;
  activity: string;
  status: string;
  avatarUrl: string;
};

export type ProfileView = {
  uid: number;
  displayName: string;
  title: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  accent: string;
  cardStyle: string;
  cardShape: string;
  nameEffect: string;
  avatarShape: string;
  avatarSize: string;
  font: string;
  buttonTheme: string;
  badges: ProfileBadge[];
  links: ProfileLink[];
  discord?: DiscordPresence;
  views?: number;
};

export type ProfileMedia = {
  avatarUrl: string;
  bannerUrl: string;
  backgroundVideoUrl: string;
  musicUrl: string;
};
