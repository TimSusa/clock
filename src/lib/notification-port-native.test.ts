import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import type { NativeNotifications } from "./notification-port";
import { createNotificationPort } from "./notification-port";

function native(): NativeNotifications {
	return {
		checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
		requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
		cancel: vi.fn().mockResolvedValue(undefined),
		schedule: vi.fn().mockResolvedValue(undefined),
		getPending: vi.fn().mockResolvedValue({ notifications: [] }),
	};
}

describe("createNotificationPort (injected native bridge)", () => {
	let n: NativeNotifications;
	beforeEach(() => {
		n = native();
	});

	it("checks permission on the injected bridge", async () => {
		const port = createNotificationPort(n);
		expect(await port.requestPermission()).toBe(true);
		expect(n.checkPermissions).toHaveBeenCalledTimes(1);
	});

	it("schedules via the injected bridge", async () => {
		const port = createNotificationPort(n);
		await port.reschedule(
			[makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })],
			new Date(2026, 10, 12, 9, 0, 0),
		);
		expect(n.schedule).toHaveBeenCalledTimes(1);
	});

	it("stays usable when the permission lookup rejects", async () => {
		(n.checkPermissions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("denied"));
		const port = createNotificationPort(n);
		await expect(port.requestPermission()).resolves.toBe(false);
		await port.reschedule(
			[makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })],
			new Date(2026, 10, 12, 9, 0, 0),
		);
		expect(n.schedule).toHaveBeenCalledTimes(1);
	});
});
