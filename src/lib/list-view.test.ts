import { beforeEach, describe, expect, it } from "vitest";
import { HolidayMode, ListPeriod, PastMode, StorageKey } from "./enums";
import { DEFAULT_LIST_VIEW, loadListView, saveListView } from "./list-view";

describe("list view persistence", () => {
	beforeEach(() => localStorage.clear());

	it("returns the documented defaults when storage is empty", () => {
		expect(loadListView()).toEqual(DEFAULT_LIST_VIEW);
		// Initial view: today's appointments, no public holidays.
		expect(DEFAULT_LIST_VIEW).toEqual({
			period: ListPeriod.Day,
			holidays: HolidayMode.Without,
			past: PastMode.Hide,
		});
	});

	it("round-trips both filter selections", () => {
		saveListView({
			period: ListPeriod.Week,
			holidays: HolidayMode.Without,
			past: PastMode.Show,
		});
		expect(loadListView()).toEqual({
			period: ListPeriod.Week,
			holidays: HolidayMode.Without,
			past: PastMode.Show,
		});
	});

	it("falls back to defaults on invalid stored values", () => {
		localStorage.setItem(StorageKey.ListPeriod, "decade");
		localStorage.setItem(StorageKey.ListHolidays, "sometimes");
		localStorage.setItem(StorageKey.ListPast, "maybe");
		expect(loadListView()).toEqual(DEFAULT_LIST_VIEW);
	});

	it("keeps a valid period while repairing an invalid holiday mode", () => {
		localStorage.setItem(StorageKey.ListPeriod, ListPeriod.Month);
		localStorage.setItem(StorageKey.ListHolidays, "bogus");
		expect(loadListView()).toEqual({
			period: ListPeriod.Month,
			holidays: HolidayMode.Without,
			past: PastMode.Hide,
		});
	});
});
