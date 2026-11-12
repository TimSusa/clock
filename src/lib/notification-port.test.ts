import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import type { NativeNotifications } from "./notification-port";
import { createNotificationPort, rescheduleWith } from "./notification-port";

const NOW = new Date(2026, 10, 12, 9, 0, 0);

describe("createNotificationPort (web fallback)", () => {
	it("degrades to a no-op port without a native bridge", async () => {
		const port = await createNotificationPort();
		expect(await port.requestPermission()).toBe(false);
		await expect(port.reschedule([makeEntry({ id: "a" })], NOW)).resolves.toBeUndefined();
	});
});

describe("rescheduleWith", () => {
	function native(): NativeNotifications {
		return {
			checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
			requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
			cancel: vi.fn().mockResolvedValue(undefined),
			schedule: vi.fn().mockResolvedValue(undefined),
			getPending: vi.fn().mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] }),
		};
	}

	it("cancels stale alarms before scheduling the current set", async () => {
		const n = native();
		await rescheduleWith(n, [makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })], NOW);
		expect(n.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 2 }] });
		expect(n.schedule).toHaveBeenCalledTimes(1);
	});

	it("skips scheduling when nothing is in the future", async () => {
		const n = native();
		await rescheduleWith(n, [makeEntry({ id: "p", iso: "2026-11-12", time: "08:00" })], NOW);
		expect(n.cancel).toHaveBeenCalledTimes(1);
		expect(n.schedule).not.toHaveBeenCalled();
	});
});
