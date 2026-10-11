import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind utilities and drops falsy values", () => {
    const hidden: boolean = false;
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-white", hidden && "hidden", undefined, null, "flex")).toBe(
      "text-white flex",
    );
  });

  it("keeps the custom layer classes used by the background player", () => {
    // These must survive merging: `bg-iframe-cover` would be dropped because
    // `tailwind-merge` reads a leading `bg-` as a background utility.
    const className = cn(
      "layer-iframe-cover",
      "absolute",
      "layer-iframe-cover--zoomed",
      "bg-iframe-cover",
    );

    expect(className).toContain("layer-iframe-cover");
    expect(className).toContain("layer-iframe-cover--zoomed");
  });

  it("keeps the profile card and sound dock classes", () => {
    expect(cn("profile-card", "card-glass", "name-shimmer")).toBe(
      "profile-card card-glass name-shimmer",
    );
    expect(cn("sound-dock", "fixed", "rounded-full")).toBe("sound-dock fixed rounded-full");
  });
});
