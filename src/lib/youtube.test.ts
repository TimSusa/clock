import { describe, expect, it } from "vitest";
import { YOUTUBE_EMBED_ORIGIN } from "./labels";
import { parseYouTubeUrl, youtubeEmbedUrl } from "./youtube";

describe("parseYouTubeUrl", () => {
	it("reads the id from a standard watch url", () => {
		expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
	});

	it("reads the id from a short youtu.be link", () => {
		expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
	});

	it("reads the id from an embed/shorts link", () => {
		expect(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
		expect(parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
	});

	it("accepts http and rejects invalid ids", () => {
		expect(parseYouTubeUrl("http://youtube.com/watch?v=abc123DEF_-")).toBe("abc123DEF_-");
		expect(parseYouTubeUrl("https://youtube.com/watch?v=short")).toBeNull();
	});

	it("rejects non-YouTube urls and empty input", () => {
		expect(parseYouTubeUrl("https://vimeo.com/123")).toBeNull();
		expect(parseYouTubeUrl("")).toBeNull();
		expect(parseYouTubeUrl("kein url")).toBeNull();
	});
});

describe("youtubeEmbedUrl", () => {
	it("builds a privacy-enhanced embed url", () => {
		expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(`${YOUTUBE_EMBED_ORIGIN}dQw4w9WgXcQ?autoplay=1`);
	});

	it("returns null for an invalid id", () => {
		expect(youtubeEmbedUrl("bad")).toBeNull();
	});
});
