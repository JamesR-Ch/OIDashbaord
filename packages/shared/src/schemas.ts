import { z } from "zod";

export const symbolSchema = z.enum(["XAUUSD", "THBUSD", "BTCUSD"]);

export const tradingViewLegacyPayloadSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().positive(),
  event_time_utc: z.string().datetime(),
  source: z.literal("tradingview")
});

export const tradingViewRealPayloadSchema = z.object({
  symbol: z.string().min(1).optional(),
  ticker: z.string().min(1).optional(),
  price: z.coerce.number().positive(),
  timestamp: z.string().min(1).optional(),
  time: z.string().min(1).optional(),
  interval: z.string().optional(),
  exchange: z.string().optional(),
  volume: z.coerce.number().optional(),
  secret: z.string().optional()
}).superRefine((val, ctx) => {
  if (!val.symbol && !val.ticker) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "symbol or ticker is required"
    });
  }
  if (!val.timestamp && !val.time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "timestamp or time is required"
    });
  }
});

export const tradingViewPayloadSchema = z.union([
  tradingViewLegacyPayloadSchema,
  tradingViewRealPayloadSchema
]);

export const cmeLinkUpdateSchema = z.object({
  url: z.string().url(),
  effective_date_bkk: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const overviewQuerySchema = z.object({
  at: z.string().datetime().optional()
});
