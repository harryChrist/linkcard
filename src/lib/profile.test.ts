import { describe, expect, it } from "vitest";

import profileJson from "@/profile.json";
import { buildProfileView, readMedia } from "@/lib/profile";

describe("buildProfileView", () => {
  it("maps the shipped profile.json", () => {
    const profile = buildProfileView(profileJson);

    expect(profile.displayName).toBe("HarryChrist");
    expect(profile.uid).toBe(1);
    expect(profile.accent).toBe("#8ab4ff");
    expect(profile.cardStyle).toBe("glass");
    expect(profile.badges).toHaveLength(4);
    expect(profile.links).toHaveLength(6);
    expect(profile.discord?.username).toBe("Chomusuke");
    expect(profile.discord?.status).toBe("online");
  });

  it("survives malformed input without throwing", () => {
    for (const input of [null, undefined, 42, "nope", [], {}]) {
      const profile = buildProfileView(input);
      expect(profile.displayName).toBe("anonymous");
      expect(profile.accent).toBe("#8ab4ff");
      expect(profile.badges).toEqual([]);
      expect(profile.links).toEqual([]);
      expect(profile.discord).toBeUndefined();
    }
  });

  it("drops empty and invalid entries", () => {
    const profile = buildProfileView({
      identity: { handle: "  dev  ", uid: Number.NaN, title: 7 },
      badges: [{ label: "  " }, { label: "Dev" }, null, "x", { label: "E2E", color: "  " }],
      links: [
        { label: "GitHub", url: "https://github.com/x", icon: "github" },
        { label: "Hidden", url: "   " },
        null,
      ],
      presence: { username: "   " },
    });

    expect(profile.displayName).toBe("dev");
    expect(profile.uid).toBe(0);
    expect(profile.title).toBe("");
    expect(profile.badges).toEqual([
      { label: "Dev", color: "#8ab4ff" },
      { label: "E2E", color: "#8ab4ff" },
    ]);
    expect(profile.links).toHaveLength(1);
    expect(profile.discord).toBeUndefined();
  });
});

describe("readMedia", () => {
  it("reads media strings with empty fallbacks", () => {
    expect(readMedia(profileJson).backgroundVideoUrl).toBe(
      "https://www.youtube.com/watch?v=eFIMruzx_Rs",
    );

    const media = readMedia({ media: { bannerUrl: 5 } });
    expect(media).toEqual({
      avatarUrl: "",
      bannerUrl: "",
      backgroundVideoUrl: "",
      musicUrl: "",
    });
  });
});
