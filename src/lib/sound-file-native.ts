import { Directory, Filesystem } from "@capacitor/filesystem";
import { isNativeShell } from "./native-shell";
import type { SoundFileSystem } from "./sound-file";

/** No-op port for the web build: there is no native Library/Sounds to write. */
const WEB_NO_OP: SoundFileSystem = {
	async mkdir() {},
	async writeFile() {},
	async deleteFile() {},
};

function nativeSoundFileSystem(): SoundFileSystem {
	return {
		async mkdir(options) {
			await Filesystem.mkdir({
				path: options.path,
				directory: Directory.Library,
				recursive: true,
			});
		},
		async writeFile(options) {
			await Filesystem.writeFile({
				path: options.path,
				directory: Directory.Library,
				data: options.data,
			});
		},
		async deleteFile(options) {
			try {
				await Filesystem.deleteFile({
					path: options.path,
					directory: Directory.Library,
				});
			} catch {
				/* already removed */
			}
		},
	};
}

/**
 * ONE platform gate for every sound-file caller (arm on reschedule, delete on
 * remove). The web build gets a silent no-op instead of a Filesystem proxy
 * that rejects every call with "This browser doesn't support IndexedDB".
 */
export function soundFilePort(): SoundFileSystem {
	return isNativeShell() ? nativeSoundFileSystem() : WEB_NO_OP;
}
