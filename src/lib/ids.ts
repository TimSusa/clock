let counter = 0;

/**
 * crypto.randomUUID is only available in secure contexts. On an iPad opening the
 * app over plain http://<lan-ip>, it is undefined - fall back to a local id.
 */
export function newEntryId(
	uuid: () => string | undefined = () =>
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: undefined,
): string {
	const value = uuid();
	if (value !== undefined && value.length > 0) return value;
	counter += 1;
	return `entry-${Date.now()}-${counter}`;
}
