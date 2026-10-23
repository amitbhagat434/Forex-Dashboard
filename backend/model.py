"""
model.py
Runs the notebook's 16-day SMA breakout strategy (Prototype 2, tranche-based)
and writes dashboard.json for the UI.

Usage:
    python export_dashboard.py                       # live FRED data, remittances.csv if present
    python export_dashboard.py --csv my_receipts.csv # columns: date, amount
    python export_dashboard.py --demo                # synthetic rates (offline test only)
"""
import argparse, json, os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

ROLLING_WINDOW = 16
MAX_CALENDAR_DAYS = 30
MAX_TRADING_DAYS = 22
REQUIRE_ABOVE_ARRIVAL = True
CHART_DAYS = 90


# ---------------------------------------------------------------- data
def load_rates(demo=False, start=datetime(2015, 1, 1)):
    if demo:
        idx = pd.bdate_range(start, datetime.today())
        rng = np.random.default_rng(7)
        rate = 62 + np.cumsum(0.012 + rng.normal(0, 0.28, len(idx)))
        df = pd.DataFrame({"rate": rate}, index=idx)
    else:
        import pandas_datareader.data as web
        df = web.DataReader("DEXINUS", "fred", start, datetime.today())
        df = df.rename(columns={"DEXINUS": "rate"}).dropna()
        df.index = pd.to_datetime(df.index)
    # shift(1): yesterday's closed 16-day mean, no lookahead (same as notebook)
    df["sma"] = df["rate"].shift(1).rolling(ROLLING_WINDOW).mean()
    return df


def load_receipts(path):
    if path and os.path.exists(path):
        r = pd.read_csv(path)
    else:  # fallback: $100k on the first trading day of each month since Jun 2016
        d = pd.date_range("2016-06-01", datetime.today(), freq="MS")
        r = pd.DataFrame({"date": d, "amount": 100_000})
    r["date"] = pd.to_datetime(r["date"])
    return r.sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------- strategy
def window_for(df, remit_date, upto=None):
    end = remit_date + timedelta(days=MAX_CALENDAR_DAYS)
    if upto is not None:
        end = min(end, upto)
    idx = df.index[(df.index >= remit_date) & (df.index <= end)][:MAX_TRADING_DAYS]
    return df.loc[idx]


def run_rule(w):
    """Same trigger as the notebook. Returns (date, rate, triggered)."""
    receipt = w["rate"].iloc[0]
    for d, row in w.iloc[1:].iterrows():
        if pd.isna(row["sma"]):
            continue
        cond = row["rate"] >= row["sma"]
        if REQUIRE_ABOVE_ARRIVAL:
            cond = cond and row["rate"] > receipt
        if cond:
            return d, row["rate"], True
    return w.index[-1], w["rate"].iloc[-1], False


def backtest(df, receipts):
    rows = []
    for _, r in receipts.iterrows():
        w = window_for(df, r["date"])
        if len(w) < 2 or r["date"] > df.index[-1] - timedelta(days=MAX_CALENDAR_DAYS):
            continue  # window not complete yet
        usd = float(r["amount"])
        d, rate, hit = run_rule(w)
        base = usd * w["rate"].iloc[0]
        best = usd * w["rate"].max()
        strat = usd * rate
        rows.append({
            "remitDate": r["date"].strftime("%Y-%m-%d"),
            "arrivalDate": w.index[0].strftime("%Y-%m-%d"),
            "usd": usd,
            "arrivalSpot": round(float(w["rate"].iloc[0]), 4),
            "execDate": d.strftime("%Y-%m-%d"),
            "execRate": round(float(rate), 4),
            "bestDate": w["rate"].idxmax().strftime("%Y-%m-%d"),
            "bestRate": round(float(w["rate"].max()), 4),
            "daysHeld": int((d - r["date"]).days),
            "forced": not hit,
            "defaultInr": base, "strategyInr": strat, "perfectInr": best,
            "profitInr": strat - base,
            "pnlPct": round((strat - base) / base * 100, 3),
        })
    return pd.DataFrame(rows)


def kpis(res):
    if res.empty:
        return {}
    win, lose = res[res.profitInr > 0], res[res.profitInr < 0]
    ideal = (res.perfectInr - res.defaultInr).sum()
    return {
        "tranches": int(len(res)),
        "usdVolume": float(res.usd.sum()),
        "winRate": round(len(win) / len(res) * 100, 1),
        "lossRate": round(len(lose) / len(res) * 100, 1),
        "forcedRate": round(res.forced.mean() * 100, 1),
        "avgDaysHeld": round(res.daysHeld.mean(), 1),
        "avgGainPct": round(win.pnlPct.mean(), 3) if len(win) else 0,
        "avgLossPct": round(lose.pnlPct.mean(), 3) if len(lose) else 0,
        "bestInr": float(res.profitInr.max()),
        "worstInr": float(res.profitInr.min()),
        "netAddedInr": float(res.profitInr.sum()),
        "cumOutperfPct": round(float((res.strategyInr.sum() - res.defaultInr.sum()) / res.defaultInr.sum() * 100), 3),
        # share of the best-possible gain (perfect hindsight) that the rule captured
        "captureRatio": round(float(res.profitInr.sum() / ideal * 100), 1) if ideal else 0,
    }


# ---------------------------------------------------------------- live signal
def live_signal(df, receipts):
    asof = df.index[-1]
    last = df.iloc[-1]
    today = {
        "date": asof.strftime("%Y-%m-%d"),
        "spot": round(float(last.rate), 4),
        "prevSpot": round(float(df["rate"].iloc[-2]), 4),
        "sma16": None if pd.isna(last["sma"]) else round(float(last["sma"]), 4),
        "aboveSma": bool(last["rate"] >= last["sma"]) if not pd.isna(last["sma"]) else None,
    }
    if today["sma16"]:
        today["gapPct"] = round((today["spot"] / today["sma16"] - 1) * 100, 3)

    open_t = []
    for _, r in receipts.iterrows():
        deadline = r["date"] + timedelta(days=MAX_CALENDAR_DAYS)
        if r["date"] > asof or deadline < asof:
            continue
        w = window_for(df, r["date"], upto=asof)
        if len(w) < 1:
            continue
        d, rate, hit = run_rule(w) if len(w) > 1 else (w.index[-1], w["rate"].iloc[-1], False)
        at_deadline = len(w) >= MAX_TRADING_DAYS or asof >= deadline
        if hit and d == asof:
            action, why = "Convert", "Spot crossed above the 16-day average and above the arrival rate."
        elif hit:
            action, why = "Convert", f"Trigger already hit on {d:%d %b} at {rate:.2f}."
        elif at_deadline:
            action, why = "Convert", "30-day window ends. Forced conversion."
        else:
            action, why = "Hold", "Waiting for spot to cross above the 16-day average and the arrival rate."
        open_t.append({
            "remitDate": r["date"].strftime("%Y-%m-%d"), "usd": float(r["amount"]),
            "arrivalRate": round(float(w["rate"].iloc[0]), 4),
            "deadline": deadline.strftime("%Y-%m-%d"),
            "daysLeft": int((deadline - asof).days),
            "action": action, "reason": why,
        })
    return today, open_t


# ---------------------------------------------------------------- output
def build_payload(df, receipts, demo=False, assumed=False, open_receipts=None):
    """Everything the dashboard needs, as plain JSON-serialisable data."""
    res = backtest(df, receipts)
    today, open_t = live_signal(df, receipts if open_receipts is None else open_receipts)
    tail = df.tail(CHART_DAYS)
    return {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "isDemo": demo,
        "assumedSchedule": assumed,
        "today": today,
        "openTranches": open_t,
        "chart": {
            "dates": [d.strftime("%Y-%m-%d") for d in tail.index],
            "spot": [round(float(x), 4) for x in tail["rate"]],
            "sma16": [None if pd.isna(x) else round(float(x), 4) for x in tail["sma"]],
        },
        "kpi": kpis(res),
        "cumulative": {
            "dates": res.execDate.tolist() if not res.empty else [],
            "profitInr": res.profitInr.cumsum().round(0).tolist() if not res.empty else [],
        },
        "tranches": json.loads(res.drop(columns=["defaultInr", "strategyInr", "perfectInr"]).to_json(orient="records")) if not res.empty else [],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="remittances.csv")
    ap.add_argument("--out", default="dashboard.json")
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    out = build_payload(load_rates(a.demo), load_receipts(a.csv), a.demo)
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2, default=float)
    print(f"Wrote {a.out}")


if __name__ == "__main__":
    main()
