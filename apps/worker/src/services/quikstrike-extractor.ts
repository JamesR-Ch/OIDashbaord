import { chromium, type Browser, type Frame, type Page } from "playwright";
import { DateTime } from "luxon";
import { workerConfig } from "../lib/config";

export interface ExtractedSnapshot {
  seriesName: string;
  expirationLabel: string | null;
  expirationDate: string | null;
  dte: number | null;
  putTotal: number;
  callTotal: number;
  vol: number | null;
  volChg: number | null;
  futureChg: number | null;
  bars: Array<{ strike: number; put: number; call: number; volSettle: number | null }>;
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const clean = v.replace(/,/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTotalsFromSubtitle(subtitle: string) {
  const normalized = subtitle.replace(/<[^>]+>/g, " ");
  const putMatch = normalized.match(/Put:\s*([\d,.-]+)/i);
  const callMatch = normalized.match(/Call:\s*([\d,.-]+)/i);
  const volMatch = normalized.match(/Vol:\s*([\d,.-]+)/i);
  const volChgMatch = normalized.match(/Vol Chg:\s*([\d,.-]+)/i);
  const futureChgMatch = normalized.match(/Fut(?:ure)? Chg:\s*([\d,.-]+)/i);

  return {
    putTotal: parseNumber(putMatch?.[1]) || 0,
    callTotal: parseNumber(callMatch?.[1]) || 0,
    vol: parseNumber(volMatch?.[1]),
    volChg: parseNumber(volChgMatch?.[1]),
    futureChg: parseNumber(futureChgMatch?.[1])
  };
}

function parseExpirationDate(raw: string): string | null {
  const isoMatch = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const slashYmd = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashYmd) {
    const mm = slashYmd[1].padStart(2, "0");
    const dd = slashYmd[2].padStart(2, "0");
    const yyyy = slashYmd[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };

  const dmy = raw.match(/\b(\d{1,2})[-\/ ]([A-Za-z]{3})[-\/ ,]+(\d{2,4})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = monthMap[dmy[2].toLowerCase()];
    const yyyy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }

  const mdy = raw.match(/\b([A-Za-z]{3})[ -]+(\d{1,2}),?[ -]+(\d{2,4})\b/);
  if (mdy) {
    const mm = monthMap[mdy[1].toLowerCase()];
    const dd = mdy[2].padStart(2, "0");
    const yyyy = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function parseDte(raw: string): number | null {
  const m = raw.match(/\b(-?\d+(?:\.\d+)?)\s*DTE\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractOptionFields(fullText: string): { optionSymbol: string | null; optionExpiration: string | null } {
  const normalized = fullText.replace(/\u00a0/g, " ");
  const exp = normalized.match(/Option\s+Expiration:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
  const symbol = normalized.match(/Option\s+Symbol:\s*([A-Z0-9]+)/i)?.[1]?.trim() || null;
  return { optionSymbol: symbol, optionExpiration: exp };
}

function findSelectedSeriesCode(payload: { title?: string; subtitle?: string; expirationLabel?: string; fullText?: string; optionTexts?: string[] }): string | null {
  const sources = [payload.title, payload.subtitle, payload.expirationLabel, payload.fullText];
  for (const source of sources) {
    if (!source) continue;
    const expMatch = source.match(/\bEXPIRATION:\s*([A-Z0-9]+)\b/i);
    if (expMatch) return expMatch[1].toUpperCase();

    const dteTitleMatch = source.match(/\)\s+([A-Z0-9]+)\s+\([-+]?\d+(?:\.\d+)?\s*DTE\)/i);
    if (dteTitleMatch) return dteTitleMatch[1].toUpperCase();
  }

  const options = payload.optionTexts || [];
  for (const row of options) {
    const m = row.match(/^\s*([A-Z0-9]+)\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/);
    if (m) return m[1].toUpperCase();
  }

  return null;
}

function findExpirationLabelAndDate(seriesCode: string | null, optionTexts: string[] = [], fallbackText = ""): { label: string | null; date: string | null } {
  if (seriesCode) {
    const codeRegex = new RegExp(`^\\s*${escapeRegex(seriesCode)}\\b`, "i");
    const exact = optionTexts.find((row) => codeRegex.test(row));
    if (exact) {
      return {
        label: exact.trim(),
        date: parseExpirationDate(exact)
      };
    }

    const anywhereRegex = new RegExp(`\\b${escapeRegex(seriesCode)}\\b`, "i");
    const loose = optionTexts.find((row) => anywhereRegex.test(row) && /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(row));
    if (loose) {
      return {
        label: loose.trim(),
        date: parseExpirationDate(loose)
      };
    }

    const lineByRows = fallbackText
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find((row) => {
        if (!row) return false;
        const hasCode = new RegExp(`\\b${escapeRegex(seriesCode)}\\b`, "i").test(row);
        const hasDate = /\b\d{1,2}[-\/ ]+[A-Za-z]{3}[-\/ ,]+\d{2,4}\b/.test(row) || /\b[A-Za-z]{3}[ -]+\d{1,2},?[ -]+\d{2,4}\b/.test(row);
        return hasCode && hasDate;
      }) || null;

    const textRegex = new RegExp(`\\b${escapeRegex(seriesCode)}\\b[^\\n]*`, "i");
    const line = lineByRows || fallbackText.match(textRegex)?.[0] || null;
    if (line) {
      return {
        label: line.trim(),
        date: parseExpirationDate(line)
      };
    }
  }

  return {
    label: null,
    date: parseExpirationDate(fallbackText)
  };
}

function findSeriesDateFromText(seriesCode: string | null, text: string): { label: string | null; date: string | null } {
  if (!seriesCode || !text) return { label: null, date: null };
  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seriesRe = new RegExp(`\\b${escapeRegex(seriesCode)}\\b`, "i");
  for (const line of lines) {
    if (!seriesRe.test(line)) continue;
    const date = parseExpirationDate(line);
    if (date) return { label: line, date };
  }

  return { label: null, date: null };
}

function inferExpirationDateFromDte(dte: number | null): string | null {
  if (typeof dte !== "number" || !Number.isFinite(dte) || dte <= 0) return null;
  const cmeNow = DateTime.now().setZone(workerConfig.cmeSessionTimezone);
  const inferred = cmeNow.plus({ minutes: Math.round(dte * 24 * 60) });
  return inferred.toISODate();
}

function roots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames().filter((f) => !f.isDetached())];
}

function isDetachedFrameError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return msg.toLowerCase().includes("frame was detached");
}

async function readOptionFieldsFromPage(page: Page): Promise<{ optionSymbol: string | null; optionExpiration: string | null; dte: number | null }> {
  for (const root of roots(page)) {
    try {
      const text = await root.locator("body").innerText();
      const fields = extractOptionFields(text || "");
      if (fields.optionExpiration || fields.optionSymbol) {
        const dte = parseDte(fields.optionExpiration || "");
        return { optionSymbol: fields.optionSymbol, optionExpiration: fields.optionExpiration, dte };
      }
    } catch (error) {
      if (!isDetachedFrameError(error)) {
        // ignore read errors in dynamic frame content
      }
    }
  }
  return { optionSymbol: null, optionExpiration: null, dte: null };
}

export async function extractQuikStrikeView(url: string, tab: "intraday" | "oi", tradeDateBkk: string): Promise<ExtractedSnapshot> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: workerConfig.cmeHeadless });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        Referer: "https://www.cmegroup.com/"
      }
    });

    const page = await context.newPage();
    await page.goto(url, { timeout: workerConfig.cmeTimeoutMs, waitUntil: "domcontentloaded" });

    const tabSelector = tab === "intraday"
      ? "#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbIntradayVolume"
      : "#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbOI";

    await page.locator(tabSelector).click({ timeout: workerConfig.cmeTimeoutMs });
    await page.waitForTimeout(4000);

    const payload = await page.evaluate(() => {
      const hc = (globalThis as any).Highcharts;
      const chart = hc?.charts?.[0];
      if (!chart) return null;

      const subtitle = chart.subtitle?.textStr || "";
      const title = chart.title?.textStr || "";

      const result: any = {
        title,
        subtitle,
        fullText: (document.body?.innerText || "").replace(/\u00a0/g, " "),
        optionTexts: Array.from(document.querySelectorAll("select option"))
          .map((opt) => (opt.textContent || "").replace(/\u00a0/g, " ").trim())
          .filter((txt) => txt.length > 0),
        call: [] as Array<{ x: number; y: number }>,
        put: [] as Array<{ x: number; y: number }>,
        vol: [] as Array<{ x: number; y: number }>
      };

      for (const series of chart.series || []) {
        const name = String(series.name || "").toLowerCase();
        const data = (series.options?.data || []).map((d: any) => {
          if (Array.isArray(d)) return { x: d[0], y: d[1] };
          return { x: d.x, y: d.y };
        });

        if (name.includes("call")) result.call = data;
        else if (name.includes("put")) result.put = data;
        else if (name.includes("vol")) result.vol = data;
      }

      const expirationNode = document.querySelector("strong");
      const parentText = expirationNode?.parentElement?.textContent || "";
      const seriesName = parentText.replace("Expiration:", "").replace(/\u00a0/g, " ").trim();
      const expirationLabel = parentText.replace(/\u00a0/g, " ").trim() || null;

      return {
        ...result,
        seriesName,
        expirationLabel
      };
    });

    if (!payload) {
      throw new Error("Highcharts payload unavailable");
    }

    const putLen = Array.isArray(payload.put) ? payload.put.length : 0;
    const callLen = Array.isArray(payload.call) ? payload.call.length : 0;
    const volLen = Array.isArray(payload.vol) ? payload.vol.length : 0;
    if (putLen === 0 && callLen === 0 && volLen === 0) {
      throw new Error(`highcharts_empty_series tab=${tab} trade_date=${tradeDateBkk}`);
    }

    const totals = extractTotalsFromSubtitle(payload.subtitle || "");
    const optionFieldsFromRoots = await readOptionFieldsFromPage(page);
    const rawHtml = await page.content();
    const optionFieldsFromHtml = extractOptionFields(rawHtml.replace(/<[^>]+>/g, " "));
    const optionFieldsFromPayload = extractOptionFields(payload.fullText || "");
    const optionFields = {
      optionSymbol: optionFieldsFromRoots.optionSymbol || optionFieldsFromHtml.optionSymbol || optionFieldsFromPayload.optionSymbol,
      optionExpiration: optionFieldsFromRoots.optionExpiration || optionFieldsFromHtml.optionExpiration || optionFieldsFromPayload.optionExpiration
    };
    const selectedSeriesCode = findSelectedSeriesCode(payload);
    const expiration = findExpirationLabelAndDate(selectedSeriesCode, payload.optionTexts || [], `${payload.fullText || ""}\n${payload.title || ""}`);
    const parsedDte = parseDte(optionFields.optionExpiration || "")
      || parseDte(`${payload.title || ""} ${payload.subtitle || ""} ${payload.fullText || ""}`);
    if (workerConfig.cmeRequirePositiveDte && !(typeof parsedDte === "number" && parsedDte > 0)) {
      throw new Error(
        `positive_dte_series_not_found trade_date=${tradeDateBkk} dte=${String(parsedDte)} mode=url_selected`
      );
    }
    const barsByStrike = new Map<number, { put: number; call: number; volSettle: number | null }>();

    for (const item of payload.put || []) {
      const strike = Number(item.x);
      const put = Number(item.y || 0);
      if (!Number.isFinite(strike)) continue;
      barsByStrike.set(strike, { ...(barsByStrike.get(strike) || { put: 0, call: 0, volSettle: null }), put });
    }

    for (const item of payload.call || []) {
      const strike = Number(item.x);
      const call = Number(item.y || 0);
      if (!Number.isFinite(strike)) continue;
      barsByStrike.set(strike, { ...(barsByStrike.get(strike) || { put: 0, call: 0, volSettle: null }), call });
    }

    for (const item of payload.vol || []) {
      const strike = Number(item.x);
      const rawVolSettle = parseNumber(item.y);
      const volSettle = rawVolSettle == null
        ? null
        : Math.round(rawVolSettle * 100 * 100) / 100;
      if (!Number.isFinite(strike)) continue;
      barsByStrike.set(strike, { ...(barsByStrike.get(strike) || { put: 0, call: 0, volSettle: null }), volSettle });
    }

    const bars = Array.from(barsByStrike.entries())
      .map(([strike, v]) => ({ strike, put: v.put || 0, call: v.call || 0, volSettle: v.volSettle }))
      .sort((a, b) => a.strike - b.strike);

    if (bars.length === 0) {
      throw new Error(`no_strike_bars_parsed tab=${tab} trade_date=${tradeDateBkk}`);
    }

    const resolvedSeries = selectedSeriesCode || payload.seriesName || optionFields.optionSymbol || "N/A";
    const seriesDate = findSeriesDateFromText(resolvedSeries, payload.fullText || "");
    const inferredDate = inferExpirationDateFromDte(parsedDte);
    return {
      seriesName: resolvedSeries,
      expirationLabel: optionFields.optionExpiration || seriesDate.label || expiration.label || payload.expirationLabel || null,
      expirationDate: parseExpirationDate(optionFields.optionExpiration || "") || seriesDate.date || expiration.date || inferredDate || null,
      dte: parsedDte,
      putTotal: totals.putTotal,
      callTotal: totals.callTotal,
      vol: totals.vol,
      volChg: totals.volChg,
      futureChg: totals.futureChg,
      bars
    };
  } finally {
    await browser?.close();
  }
}
