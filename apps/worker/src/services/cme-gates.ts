import { DateTime } from "luxon";
import { db } from "../lib/db";
import { workerConfig } from "../lib/config";
import type { SymbolCode } from "@oid/shared";

const BKK_ZONE = "Asia/Bangkok";
const FX_SESSION_ZONE = "America/New_York";
const CET_MARKET_ZONE = "Europe/Berlin";

export function getTradeDate(now = DateTime.now().setZone(BKK_ZONE)): string {
  return now.toISODate() || "";
}

function isAfterCutover(now: DateTime): boolean {
  const cutover = now.set({ hour: 5, minute: 30, second: 0, millisecond: 0 });
  return now >= cutover;
}

async function expireOlderActiveLinks(tradeDate: string) {
  await db
    .from("cme_series_links")
    .update({ status: "expired" })
    .lt("trade_date_bkk", tradeDate)
    .eq("status", "active");
}

export function getCmeGoldSessionState(nowUtc = DateTime.utc()) {
  const sessionTime = nowUtc.setZone(workerConfig.cmeSessionTimezone);
  const sessionDate = sessionTime.toISODate() || "";
  const weekday = sessionTime.weekday; // 1 Mon ... 7 Sun
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const maintenanceStart = 16 * 60;
  const maintenanceEnd = 17 * 60;

  if (workerConfig.cmeSessionForceOpen) {
    return {
      open: true,
      reason: "force_open_enabled",
      session_time: sessionTime.toISO()
    };
  }

  if (workerConfig.cmeHolidayClosures.includes(sessionDate)) {
    return {
      open: false,
      reason: "holiday_closure",
      session_time: sessionTime.toISO()
    };
  }

  if (weekday === 6) {
    return { open: false, reason: "saturday_closed", session_time: sessionTime.toISO() };
  }
  if (weekday === 7 && minuteOfDay < maintenanceEnd) {
    return { open: false, reason: "sunday_pre_open", session_time: sessionTime.toISO() };
  }
  if (weekday === 5 && minuteOfDay >= maintenanceStart) {
    return { open: false, reason: "friday_post_close", session_time: sessionTime.toISO() };
  }
  if (minuteOfDay >= maintenanceStart && minuteOfDay < maintenanceEnd) {
    return { open: false, reason: "daily_maintenance_break", session_time: sessionTime.toISO() };
  }

  return {
    open: true,
    reason: "session_open",
    session_time: sessionTime.toISO()
  };
}

export function getFxSessionState(nowUtc = DateTime.utc()) {
  const sessionTime = nowUtc.setZone(FX_SESSION_ZONE);
  const weekday = sessionTime.weekday; // 1 Mon ... 7 Sun
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const openMinute = 17 * 60; // 17:00 NY

  if (weekday === 6) {
    return { open: false, reason: "fx_saturday_closed", session_time: sessionTime.toISO() };
  }
  if (weekday === 7 && minuteOfDay < openMinute) {
    return { open: false, reason: "fx_sunday_pre_open", session_time: sessionTime.toISO() };
  }
  if (weekday === 5 && minuteOfDay >= openMinute) {
    return { open: false, reason: "fx_friday_post_close", session_time: sessionTime.toISO() };
  }

  return { open: true, reason: "fx_session_open", session_time: sessionTime.toISO() };
}

// CET server-time schedule:
// - Mon-Thu: 00:00-23:00
// - Fri: 00:00-22:00
// - Sat/Sun: closed
export function getIfcXauSessionState(nowUtc = DateTime.utc()) {
  const sessionTime = nowUtc.setZone(CET_MARKET_ZONE);
  const weekday = sessionTime.weekday; // 1 Mon ... 7 Sun
  const minuteOfDay = sessionTime.hour * 60 + sessionTime.minute;
  const weekdayClose = 23 * 60;
  const fridayClose = 22 * 60;

  if (weekday === 6) {
    return { open: false, reason: "ifc_metal_saturday_closed", session_time: sessionTime.toISO() };
  }
  if (weekday === 7) {
    return { open: false, reason: "ifc_metal_sunday_closed", session_time: sessionTime.toISO() };
  }
  if (weekday === 5 && minuteOfDay >= fridayClose) {
    return { open: false, reason: "ifc_metal_friday_post_close", session_time: sessionTime.toISO() };
  }
  if (weekday >= 1 && weekday <= 4 && minuteOfDay >= weekdayClose) {
    return { open: false, reason: "ifc_metal_weekday_post_close", session_time: sessionTime.toISO() };
  }

  return { open: true, reason: "ifc_metal_session_open", session_time: sessionTime.toISO() };
}

export function isSymbolMarketOpen(symbol: SymbolCode, nowUtc = DateTime.utc()) {
  const configuredMode = workerConfig.symbolSessionModes[symbol] || "auto";
  const mode = configuredMode === "auto"
    ? (symbol === "BTCUSD" ? "always_open" : "ifc_metal")
    : configuredMode;

  if (mode === "always_open") {
    return { open: true, reason: "crypto_24_7", session_time: nowUtc.toISO() };
  }
  if (mode === "always_closed") {
    return { open: false, reason: "symbol_forced_closed", session_time: nowUtc.toISO() };
  }
  if (mode === "ifc_metal") {
    return getIfcXauSessionState(nowUtc);
  }
  return getFxSessionState(nowUtc);
}

export async function isCmeJobAllowed(nowBkk = DateTime.now().setZone(BKK_ZONE)) {
  const sessionState = getCmeGoldSessionState(nowBkk.toUTC());
  if (!sessionState.open) {
    return {
      allowed: false,
      reason: "cme_session_closed",
      details: sessionState
    };
  }

  const tradeDate = getTradeDate(nowBkk);
  await expireOlderActiveLinks(tradeDate);

  const { data } = await db
    .from("cme_series_links")
    .select("trade_date_bkk,status,updated_at,url")
    .eq("trade_date_bkk", tradeDate)
    .maybeSingle();

  if (!data) {
    return {
      allowed: false,
      reason: "missing_link_for_trade_date",
      details: {
        ...sessionState,
        trade_date: tradeDate
      }
    };
  }

  if (data.status !== "active") {
    return {
      allowed: false,
      reason: `link_status_${data.status}`,
      details: {
        ...sessionState,
        trade_date: tradeDate,
        link_status: data.status
      }
    };
  }

  const updatedAt = DateTime.fromISO(data.updated_at).setZone(BKK_ZONE);
  const cutover = nowBkk.set({ hour: 5, minute: 30, second: 0, millisecond: 0 });

  if (isAfterCutover(nowBkk) && updatedAt < cutover) {
    return {
      allowed: false,
      reason: "link_not_updated_post_cutover",
      details: {
        ...sessionState,
        trade_date: tradeDate,
        cutover_bkk: cutover.toISO(),
        updated_at_bkk: updatedAt.toISO()
      }
    };
  }

  return {
    allowed: true,
    reason: "ok",
    url: data.url,
    tradeDate,
    details: {
      ...sessionState,
      trade_date: tradeDate
    }
  };
}
