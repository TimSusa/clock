import { combineDateTime } from "./alarm";
import { defaultChime } from "./chime";
import { EntryCategory } from "./enums";
import { newEntryId } from "./ids";
import { isoDateKey } from "./time";
import type { CalendarEntry } from "./types";

const EVENT_DURATION_MS = 60 * 60 * 1000;
const PRODUCT_ID = "-//Clock//DE";

function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

function unescapeText(value: string): string {
	return value
		.replace(/\\n/g, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\");
}

/** UTC compact form: YYYYMMDDTHHMMSSZ */
function toUtcStamp(date: Date): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return (
		`${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
		`T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
	);
}

function parseUtcStamp(value: string): Date | null {
	const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
	if (!match) return null;
	return new Date(
		Date.UTC(
			Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
			Number(match[4]),
			Number(match[5]),
			Number(match[6]),
		),
	);
}

function makeId(uid: string): string {
	return uid.replace(/@clock$/, "");
}

export function exportIcs(entries: readonly CalendarEntry[]): string {
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		`PRODID:${PRODUCT_ID}`,
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
	];

	for (const entry of entries) {
		const start = combineDateTime(entry.iso, entry.time);
		if (!start) continue;
		const end = new Date(start.getTime() + EVENT_DURATION_MS);
		lines.push(
			"BEGIN:VEVENT",
			`UID:${makeId(entry.id)}@clock`,
			`DTSTAMP:${toUtcStamp(new Date())}`,
			`DTSTART:${toUtcStamp(start)}`,
			`DTEND:${toUtcStamp(end)}`,
			`SUMMARY:${escapeText(entry.title)}`,
			`DESCRIPTION:${escapeText(entry.note)}`,
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			"TRIGGER:-PT0M",
			`DESCRIPTION:${escapeText(entry.title)}`,
			"END:VALARM",
			"END:VEVENT",
		);
	}

	lines.push("END:VCALENDAR");
	return `${lines.join("\r\n")}\r\n`;
}

/** Export without a file: ICS text + a readable summary for the in-app view / clipboard. */
export function internalExportText(entries: readonly CalendarEntry[]): {
	ics: string;
	summary: string;
	count: number;
} {
	const summary = entries.map((entry) => `${entry.iso} ${entry.time} · ${entry.title}`).join("\n");
	return { ics: exportIcs(entries), summary, count: entries.length };
}

/** Unfold RFC 5545 folded lines and keep only VEVENT content lines. */
function veventBlocks(text: string): string[][] {
	const unfolded = text
		.replace(/\r\n/g, "\n")
		.replace(/\n[ \t]/g, "")
		.split("\n");

	const blocks: string[][] = [];
	let current: string[] | null = null;
	for (const line of unfolded) {
		if (line === "BEGIN:VEVENT") {
			current = [];
		} else if (line === "END:VEVENT") {
			if (current) blocks.push(current);
			current = null;
		} else if (current) {
			current.push(line);
		}
	}
	return blocks;
}

export function parseIcs(text: string): readonly CalendarEntry[] {
	const result: CalendarEntry[] = [];

	for (const block of veventBlocks(text)) {
		let uid = "";
		let start: Date | null = null;
		let title = "";
		let note = "";
		let inAlarm = false;

		for (const line of block) {
			if (line === "BEGIN:VALARM") {
				inAlarm = true;
				continue;
			}
			if (line === "END:VALARM") {
				inAlarm = false;
				continue;
			}
			if (inAlarm) continue;
			const colon = line.indexOf(":");
			if (colon < 0) continue;
			const key = line.slice(0, colon).split(";")[0] ?? "";
			const value = line.slice(colon + 1);
			switch (key) {
				case "UID":
					uid = value;
					break;
				case "DTSTART":
					start = parseUtcStamp(value.trim());
					break;
				case "SUMMARY":
					title = unescapeText(value);
					break;
				case "DESCRIPTION":
					note = unescapeText(value);
					break;
			}
		}

		if (!start || title.length === 0) continue;
		result.push({
			id: makeId(uid) || newEntryId(),
			iso: isoDateKey(start),
			time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
			title,
			category: EntryCategory.Event,
			note,
			...defaultChime(),
		});
	}

	return result;
}
