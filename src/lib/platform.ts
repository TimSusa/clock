/** iPadOS may report "Macintosh"; touch points distinguish it from a real Mac. */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
	const isIosDevice = /iPad|iPhone|iPod/.test(userAgent);
	const isIpadDesktopMode = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
	return isIosDevice || isIpadDesktopMode;
}
