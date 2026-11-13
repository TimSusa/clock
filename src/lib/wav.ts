/**
 * One source of truth for native notification audio. iOS UNNotificationSound
 * only plays WAV/CAF/AIFF containers from Library/Sounds - a MediaRecorder
 * WebM/MP4 blob (or an MP3) written under a *.wav name stays silent. So every
 * own chime is transcoded to real 16-bit PCM WAV before it is stored.
 */

export interface DecodedAudio {
	numberOfChannels: number;
	sampleRate: number;
	length: number;
	getChannelData(channel: number): Float32Array;
}

export interface WavDeps {
	decode(blob: Blob): Promise<DecodedAudio>;
	toDataUrl(bytes: Uint8Array): Promise<string>;
}

/** RIFF/WAVE, mono, 16-bit PCM, little-endian. */
export function encodeWav(mono: Float32Array, sampleRate: number): Uint8Array {
	const dataBytes = mono.length * 2;
	const bytes = new Uint8Array(44 + dataBytes);
	const view = new DataView(bytes.buffer);

	const ascii = (offset: number, text: string): void => {
		for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
	};

	ascii(0, "RIFF");
	view.setUint32(4, 36 + dataBytes, true);
	ascii(8, "WAVE");
	ascii(12, "fmt ");
	view.setUint32(16, 16, true); // fmt chunk size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate
	view.setUint16(32, 2, true); // block align
	view.setUint16(34, 16, true); // bits per sample
	ascii(36, "data");
	view.setUint32(40, dataBytes, true);

	for (let i = 0; i < mono.length; i += 1) {
		const clamped = Math.max(-1, Math.min(1, mono[i] ?? 0));
		const pcm = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
		view.setInt16(44 + i * 2, pcm, true);
	}
	return bytes;
}

/**
 * A data URL that iOS UNNotificationSound can actually play from
 * Library/Sounds. After a failed transcode the raw audio/mp4 or audio/webm
 * blob is kept for foreground playback, but it must NEVER be written as a
 * *.wav notification sound (iOS would stay silent).
 */
export function isPlayableWavDataUrl(dataUrl: string): boolean {
	return /^data:audio\/(wav|wave|x-wav);base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
}

/** Structural check used by tests / diagnostics (no decoding involved). */
export function wavHeaderIsValid(bytes: Uint8Array): boolean {
	if (bytes.length < 44) return false;
	const tag = (offset: number): string =>
		String.fromCharCode(...new Uint8Array(bytes.buffer, bytes.byteOffset + offset, 4));
	return tag(0) === "RIFF" && tag(8) === "WAVE" && tag(12) === "fmt " && tag(36) === "data";
}

/** Mix all channels down to mono so the WAV stays single-channel. */
function mixToMono(audio: DecodedAudio): Float32Array {
	const mono = new Float32Array(audio.length);
	for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
		const data = audio.getChannelData(channel);
		for (let i = 0; i < audio.length; i += 1) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0);
	}
	if (audio.numberOfChannels > 1) {
		for (let i = 0; i < mono.length; i += 1) mono[i] = (mono[i] ?? 0) / audio.numberOfChannels;
	}
	return mono;
}

/** Transcode any decodable audio blob into a WAV data URL. */
export async function toWavDataUrl(blob: Blob, deps: WavDeps): Promise<string> {
	const audio = await deps.decode(blob);
	const wav = encodeWav(mixToMono(audio), audio.sampleRate);
	return deps.toDataUrl(wav);
}

/**
 * Single entry point for ANY own chime (microphone recording OR picked MP3).
 * The raw Blob is decoded directly - no data-URL round-trip - so iOS audio/mp4
 * reaches decodeAudioData intact. Already-WAV blobs pass through.
 */
export async function normalizeOwnChime(blob: Blob, deps: WavDeps): Promise<string> {
	if (blob.type === "audio/wav" || blob.type === "audio/wave" || blob.type === "audio/x-wav") {
		return blobToDataUrl(blob);
	}
	return toWavDataUrl(blob, deps);
}

/** Blob → data URL. Used for the final WAV and for already-WAV input. */
export function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** Read a Blob as ArrayBuffer, preferring the modern API, falling back to FileReader. */
async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
	if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
	return new Promise<ArrayBuffer>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(blob);
	});
}

/** Browser/WebAudio-backed deps. Injectable so jsdom tests stay pure. */
export function browserWavDeps(): WavDeps {
	return {
		async decode(blob: Blob): Promise<DecodedAudio> {
			const context = new AudioContext();
			try {
				const arrayBuffer = await blobBytes(blob);
				const buffer = await context.decodeAudioData(arrayBuffer);
				return {
					numberOfChannels: buffer.numberOfChannels,
					sampleRate: buffer.sampleRate,
					length: buffer.length,
					getChannelData: (channel: number) => buffer.getChannelData(channel),
				};
			} finally {
				void context.close();
			}
		},
		async toDataUrl(bytes: Uint8Array): Promise<string> {
			const buffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			return blobToDataUrl(new Blob([buffer], { type: "audio/wav" }));
		},
	};
}
