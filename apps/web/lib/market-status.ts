import { DateTime } from "luxon";

export interface MarketState {
  open: boolean;
  reason: string;
  session_time_utc: string | null;
}

export interface DashboardMarketStatus {
  checked_at_utc: string | null;
  xauusd: MarketState;
  thbusd: MarketState;
  cme_gold: MarketState;
}

const FX_SESSION_ZONE = "America/New_York";
const DEFAULT_CME_ZONE = process.env.CME_SESSION_TIMEZONE || "America/Chicago";
const IFC_METAL_ZONE = "Europe/Berlin";
const CME_HOLIDAY_CLOSURES = (process.env.CME_HOLIDAY_CLOSURES || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

export function getFxSessionState(nowUtc = DateTime.utc()): MarketState {
  const sessionTime = nowUtc.setZone(FX_SESSION_ZONE);
  const weekday = sessionTime.weekday;
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const openMinute = 17 * 60; // 17:00 New York

  if (weekday === 6) {
    return { open: false, reason: "fx_saturday_closed", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 7 && minuteOfDay < openMinute) {
    return { open: false, reason: "fx_sunday_pre_open", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 5 && minuteOfDay >= openMinute) {
    return { open: false, reason: "fx_friday_post_close", session_time_utc: sessionTime.toUTC().toISO() };
  }

  return { open: true, reason: "fx_session_open", session_time_utc: sessionTime.toUTC().toISO() };
}

// IFC metals schedule (CET/CEST reference):
// - Open Sunday 23:00 Berlin
// - Mon-Thu maintenance break 22:00-23:00 Berlin
// - Close Friday 22:00 Berlin
export function getIfcXauSessionState(nowUtc = DateTime.utc()): MarketState {
  const sessionTime = nowUtc.setZone(IFC_METAL_ZONE);
  const weekday = sessionTime.weekday;
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const breakStart = 22 * 60;
  const breakEnd = 23 * 60;

  if (weekday === 6) {
    return { open: false, reason: "ifc_metal_saturday_closed", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 7 && minuteOfDay < breakEnd) {
    return { open: false, reason: "ifc_metal_sunday_pre_open", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 5 && minuteOfDay >= breakStart) {
    return { open: false, reason: "ifc_metal_friday_post_close", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday >= 1 && weekday <= 4 && minuteOfDay >= breakStart && minuteOfDay < breakEnd) {
    return { open: false, reason: "ifc_metal_daily_break", session_time_utc: sessionTime.toUTC().toISO() };
  }

  return { open: true, reason: "ifc_metal_session_open", session_time_utc: sessionTime.toUTC().toISO() };
}

export function getCmeGoldSessionState(nowUtc = DateTime.utc()): MarketState {
  const sessionTime = nowUtc.setZone(DEFAULT_CME_ZONE);
  const sessionDate = sessionTime.toISODate() || "";
  const weekday = sessionTime.weekday;
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const maintenanceStart = 16 * 60;
  const maintenanceEnd = 17 * 60;

  if (CME_HOLIDAY_CLOSURES.includes(sessionDate)) {
    return { open: false, reason: "holiday_closure", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 6) {
    return { open: false, reason: "saturday_closed", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 7 && minuteOfDay < maintenanceEnd) {
    return { open: false, reason: "sunday_pre_open", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (weekday === 5 && minuteOfDay >= maintenanceStart) {
    return { open: false, reason: "friday_post_close", session_time_utc: sessionTime.toUTC().toISO() };
  }
  if (minuteOfDay >= maintenanceStart && minuteOfDay < maintenanceEnd) {
    return { open: false, reason: "daily_maintenance_break", session_time_utc: sessionTime.toUTC().toISO() };
  }

  return { open: true, reason: "session_open", session_time_utc: sessionTime.toUTC().toISO() };
}

export function getDashboardMarketStatus(nowUtc = DateTime.utc()): DashboardMarketStatus {
  const xau = getIfcXauSessionState(nowUtc);
  const fx = getFxSessionState(nowUtc);
  const cme = getCmeGoldSessionState(nowUtc);

  return {
    checked_at_utc: nowUtc.toISO(),
    xauusd: xau,
    thbusd: fx,
    cme_gold: cme
  };
}
