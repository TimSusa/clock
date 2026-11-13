import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { notificationIdFor } from "./notification-plan";
import type { NativeNotifications } from "./notification-port";
import { createNotificationPort, rescheduleWith } from "./notification-port";

const NOW = new Date(2026, 10, 12, 9, 0, 0);

describe("createNotificationPort (web fallback)", () => {
	it("degrades to a no-op port without a native bridge", async () => {
		const port = createNotificationPort(null);
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

	it("passes interruptionLevel + foreground so the Lock Screen shows the alarm", async () => {
		const n = native();
		await rescheduleWith(n, [makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })], NOW);
		const payload = (n.schedule as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
			notifications: Array<Record<string, unknown>>;
		};
		expect(payload.notifications[0]?.interruptionLevel).toBe("timeSensitive");
		expect(payload.notifications[0]?.foreground).toBe(true);
	});

	it("passes actionTypeId and entryId extra so alarm buttons can act on the right event", async () => {
		const n = native();
		await rescheduleWith(n, [makeEntry({ id: "evt-1", iso: "2026-11-12", time: "10:00" })], NOW);
		const payload = (n.schedule as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
			notifications: Array<Record<string, unknown>>;
		};
		expect(payload.notifications[0]?.actionTypeId).toBe("CLOCK_ALARM");
		expect(payload.notifications[0]?.extra).toEqual({ entryId: "evt-1" });
	});

	it("STILL schedules when getPending hangs (the iOS lock-screen bug)", async () => {
		const n = native();
		(n.getPending as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
		await rescheduleWith(n, [makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })], NOW);
		expect(n.schedule).toHaveBeenCalledTimes(1);
	});

	it("STILL schedules when getPending rejects", async () => {
		const n = native();
		(n.getPending as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("getPending-failed"));
		await rescheduleWith(n, [makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })], NOW);
		expect(n.schedule).toHaveBeenCalledTimes(1);
	});

	it("never cancels an id that was just scheduled", async () => {
		const n = native();
		(n.getPending as ReturnType<typeof vi.fn>).mockResolvedValue({
			notifications: [{ id: notificationIdFor("f") }, { id: 999 }],
		});
		await rescheduleWith(n, [makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" })], NOW);
		await Promise.resolve(); // let the best-effort cleanup settle
		expect(n.cancel).toHaveBeenCalledWith({ notifications: [{ id: 999 }] });
	});

	it("skips scheduling when nothing is in the future", async () => {
		const n = native();
		await rescheduleWith(n, [makeEntry({ id: "p", iso: "2026-11-12", time: "08:00" })], NOW);
		expect(n.cancel).toHaveBeenCalledTimes(1);
		expect(n.schedule).not.toHaveBeenCalled();
	});
});
