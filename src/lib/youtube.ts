import { YOUTUBE_EMBED_ORIGIN } from "./labels";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
/**
 * Extract an 11-char video id from ANY YouTube share shape. Mobile "Share"
 * links arrive with tracking params (`&si=`, `?feature=share`), surrounding
 * text, `music.youtube.com`, or even without a URL scheme. So: strip the
 * YouTube host out of the string, then cut everything AFTER the id.
 */
export function parseYouTubeUrl(raw: string): string | null {
	const text = raw.trim();
	if (text.length === 0) return null;

	// Find the YouTube URL inside arbitrary surrounding text / missing scheme.
	const hostMatch = /(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube(?:-nocookie)?\.com|youtu\.be)/i.exec(
		text,
	);
	if (!hostMatch) return null;
	const fromHost = text.slice(hostMatch.index);

	// `?v=` / `&v=` (works even with trailing text after the id).
	const vParam = /[?&]v=([A-Za-z0-9_-]{11})/.exec(fromHost);
	if (vParam?.[1] && VIDEO_ID.test(vParam[1])) return vParam[1];

	// Path forms: /watch, /embed/, /shorts/, /live/, /v/, youtu.be/<id>.
	const path = /^\S*?\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(fromHost);
	if (path?.[1]) return path[1];
	const short = /youtu\.be\/([A-Za-z0-9_-]{11})/i.exec(fromHost);
	if (short?.[1]) return short[1];

	return null;
}

export function youtubeEmbedUrl(id: string): string | null {
	return VIDEO_ID.test(id) ? `${YOUTUBE_EMBED_ORIGIN}${id}?autoplay=1` : null;
}
