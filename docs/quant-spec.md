# OIDashboard Quant Spec (V1)

## Scope

30-minute relation engine for `XAUUSD`, `THBUSD`, `BTCUSD`.

## Core Metrics

- Absolute change: `delta_abs = p_now - p_30m_ago`
- Percentage change: `delta_pct = ((p_now - p_30m_ago) / p_30m_ago) * 100`
- Relative movement:
  - `delta_pct_xau - delta_pct_btc`
  - `delta_pct_xau - delta_pct_thb`
  - `delta_pct_btc - delta_pct_thb`

## Advanced Metrics

- Rolling correlation (Pearson) on minute returns over the 30m window.
- Pair beta (OLS slope):
  - `beta = cov(r_a, r_b) / var(r_a)`
- Spread:
  - `spread = delta_pct_a - delta_pct_b`
- Spread z-score:
  - `z = (spread_current - mean(spread_window)) / std(spread_window)`
- Relative strength composite:
  - `score = 0.6*(delta_pct_a - delta_pct_b) + 0.25*beta - 0.15*z`

## Quality Rules

- Minimum expected points per symbol in 30m window: `24`.
- If below minimum:
  - mark symbol `degraded = true`
  - still persist snapshot with `quality_flags.degraded_symbols`.

## Data Freshness

- Webhook ingest every minute.
- Relation snapshot jobs at `:00` and `:30` GMT+7.
