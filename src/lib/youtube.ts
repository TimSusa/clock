import { YOUTUBE_EMBED_ORIGIN } from "./labels";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extract an 11-char video id from common YouTube url shapes. */
export function parseYouTubeUrl(raw: string): string | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}

	const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
	let id: string | null = null;

	if (host === "youtube.com" || host === "youtube-nocookie.com") {
		if (url.pathname === "/watch") {
			id = url.searchParams.get("v");
		} else {
			const match = /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(url.pathname);
			id = match?.[1] ?? null;
		}
	} else if (host === "youtu.be") {
		id = url.pathname.slice(1).split("/")[0] ?? null;
	}

	return id !== null && VIDEO_ID.test(id) ? id : null;
}

export function youtubeEmbedUrl(id: string): string | null {
	return VIDEO_ID.test(id) ? `${YOUTUBE_EMBED_ORIGIN}${id}?autoplay=1` : null;
}
