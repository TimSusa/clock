import { DEFAULT_CHIME_NAME } from "./constants";
import { ChimeSource } from "./enums";

export interface DefaultChime {
	chimeSource: ChimeSource;
	chimeName: string;
	chimeDataUrl: string;
	extraChime: boolean;
}

/** Single source of truth for chime defaults, shared by production code and tests. */
export function defaultChime(): DefaultChime {
	return {
		chimeSource: ChimeSource.Default,
		chimeName: DEFAULT_CHIME_NAME,
		chimeDataUrl: "",
		extraChime: false,
	};
}
