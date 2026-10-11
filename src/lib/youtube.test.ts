import { describe, expect, it } from "vitest";

import {
  buildYouTubeEmbedUrl,
  isYouTubeUrl,
  parseYouTubeId,
  postYouTubeCaptionSuppression,
  postYouTubeCommand,
  postYouTubeListening,
  postYouTubeUnloadModules,
  readYouTubeMessage,
} from "@/lib/youtube";

const ID = "eFIMruzx_Rs";

describe("parseYouTubeId", () => {
  it("handles watch URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://youtube.com/watch?v=${ID}&t=12s`)).toBe(ID);
    expect(parseYouTubeId(`https://m.youtube.com/watch?app=desktop&v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("handles short, embed and shorts URLs", () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://youtu.be/${ID}?t=30`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`//www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("returns null for invalid input", () => {
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("   ")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
    expect(parseYouTubeId("https://example.com/watch?v=" + ID)).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/")).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
  });
});

describe("isYouTubeUrl", () => {
  it("recognises YouTube hosts only", () => {
    expect(isYouTubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)).toBe(true);
    expect(isYouTubeUrl("https://cdn.example.com/clip.mp4")).toBe(false);
    expect(isYouTubeUrl("")).toBe(false);
  });
});

describe("buildYouTubeEmbedUrl", () => {
  it("builds a nocookie embed with all playback flags", () => {
    const url = buildYouTubeEmbedUrl(ID, { origin: "https://linkcard.app" });
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://www.youtube-nocookie.com");
    expect(parsed.pathname).toBe(`/embed/${ID}`);
    expect(parsed.searchParams.get("autoplay")).toBe("1");
    expect(parsed.searchParams.get("mute")).toBe("1");
    expect(parsed.searchParams.get("loop")).toBe("1");
    expect(parsed.searchParams.get("playlist")).toBe(ID);
    expect(parsed.searchParams.get("controls")).toBe("0");
    expect(parsed.searchParams.get("modestbranding")).toBe("1");
    expect(parsed.searchParams.get("rel")).toBe("0");
    expect(parsed.searchParams.get("iv_load_policy")).toBe("3");
    expect(parsed.searchParams.get("fs")).toBe("0");
    expect(parsed.searchParams.get("playsinline")).toBe("1");
    expect(parsed.searchParams.get("enablejsapi")).toBe("1");
    expect(parsed.searchParams.get("cc_load_policy")).toBe("0");
    expect(parsed.searchParams.get("origin")).toBe("https://linkcard.app");
  });

  it("omits origin when there is none", () => {
    const url = buildYouTubeEmbedUrl(ID, { origin: "" });
    expect(new URL(url).searchParams.has("origin")).toBe(false);
  });
});

function fakeTarget() {
  const sent: unknown[] = [];
  return {
    sent,
    postMessage(message: string) {
      sent.push(JSON.parse(message));
    },
  };
}

describe("postMessage helpers", () => {
  it("sends commands in the format the iframe player expects", () => {
    const target = fakeTarget();
    postYouTubeCommand(target, "setVolume", [70]);
    postYouTubeListening(target, 7);

    expect(target.sent).toEqual([
      { event: "command", func: "setVolume", args: [70] },
      { event: "listening", id: 7, channel: "widget" },
    ]);
  });

  it("unloads the captions modules so no subtitle is drawn over the video", () => {
    const target = fakeTarget();
    postYouTubeUnloadModules(target);

    expect(target.sent).toEqual([
      { event: "command", func: "unloadModule", args: ["captions"] },
      { event: "command", func: "unloadModule", args: ["cc"] },
    ]);
  });

  it("also clears the selected caption track, not just the module", () => {
    const target = fakeTarget();
    postYouTubeCaptionSuppression(target);

    expect(target.sent).toEqual([
      { event: "command", func: "unloadModule", args: ["captions"] },
      { event: "command", func: "unloadModule", args: ["cc"] },
      { event: "command", func: "setOption", args: ["captions", "track", {}] },
    ]);
  });

  it("ignores missing targets instead of throwing", () => {
    expect(() => postYouTubeCommand(null, "playVideo")).not.toThrow();
    expect(() => postYouTubeListening(undefined)).not.toThrow();
    expect(() => postYouTubeUnloadModules(null)).not.toThrow();
    expect(() => postYouTubeCaptionSuppression(null)).not.toThrow();
  });
});

describe("readYouTubeMessage", () => {
  it("accepts JSON strings and plain objects", () => {
    expect(readYouTubeMessage('{"event":"onReady"}')).toEqual({ event: "onReady", info: {} });
    expect(readYouTubeMessage({ event: "infoDelivery", info: { currentTime: 4.2 } })).toEqual({
      event: "infoDelivery",
      info: { currentTime: 4.2 },
    });
  });

  it("rejects anything else", () => {
    expect(readYouTubeMessage("not json")).toBeNull();
    expect(readYouTubeMessage(null)).toBeNull();
    expect(readYouTubeMessage(42)).toBeNull();
    expect(readYouTubeMessage({})).toBeNull();
    expect(readYouTubeMessage({ event: 5 })).toBeNull();
  });
});
