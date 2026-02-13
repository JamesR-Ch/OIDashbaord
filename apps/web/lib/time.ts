import { DateTime } from "luxon";

export const BKK_ZONE = "Asia/Bangkok";

export function nowBkk(): DateTime {
  return DateTime.now().setZone(BKK_ZONE);
}

export function toBkkIso(input: string): string {
  return DateTime.fromISO(input, { zone: "utc" }).setZone(BKK_ZONE).toISO() || input;
}

export function tradeDateBkk(input?: string): string {
  const dt = input
    ? DateTime.fromISO(input, { zone: BKK_ZONE })
    : nowBkk();
  return dt.toISODate() || "";
}
