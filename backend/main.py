"""FastAPI wrapper around model.py. The strategy stays in Python; React only calls this API."""
import os, time
from datetime import date as Date
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import model

DEMO = os.getenv("FX_DEMO") == "1"
CSV = os.path.join(os.path.dirname(__file__), "remittances.csv")
COLS = ["date", "amount", "status", "convertedDate", "convertedRate"]
RATE_TTL = 3600  # seconds before FRED is queried again

app = FastAPI(title="USD/INR conversion desk API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

_cache = {"t": 0.0, "df": None}


def rates(force=False):
    if force or _cache["df"] is None or time.time() - _cache["t"] > RATE_TTL:
        try:
            _cache["df"], _cache["t"] = model.load_rates(DEMO), time.time()
        except Exception as e:  # FRED unreachable
            if _cache["df"] is None:
                raise HTTPException(503, f"Could not load rates: {e}")
    return _cache["df"]


def read_csv():
    """Older files with only date,amount are upgraded automatically."""
    if not os.path.exists(CSV):
        return pd.DataFrame(columns=COLS)
    df = pd.read_csv(CSV, dtype={"status": "object", "convertedDate": "object"})
    for c in COLS:
        if c not in df:
            df[c] = None
    df["status"] = df["status"].fillna("open")
    return df[COLS]


def write_csv(df):
    df.to_csv(CSV, index=False)


def nn(v):
    return None if pd.isna(v) else v


class Remittance(BaseModel):
    date: Date
    amount: float = Field(gt=0)


class Conversion(BaseModel):
    date: Date
    rate: float = Field(gt=0)


def actuals(df, raw):
    """Compare what was really converted with what the model's rule would have done."""
    out, last = [], df.index[-1]
    for _, r in raw[raw.status == "converted"].iterrows():
        d = pd.to_datetime(r.date)
        w = model.window_for(df, d)
        if len(w) < 1:
            continue
        arrival, usd, rate = float(w["rate"].iloc[0]), float(r.amount), float(r.convertedRate)
        md, mrate, hit = model.run_rule(w) if len(w) > 1 else (None, None, False)
        complete = len(w) >= model.MAX_TRADING_DAYS or d + pd.Timedelta(days=model.MAX_CALENDAR_DAYS) <= last
        if hit:
            status = "Triggered"
        elif complete and md is not None:
            status = "Forced at deadline"
        else:
            status, md, mrate = "Pending", None, None
        out.append({
            "remitDate": str(r.date)[:10], "usd": usd, "arrivalRate": round(arrival, 4),
            "actualDate": str(r.convertedDate)[:10], "actualRate": round(rate, 4),
            "modelDate": None if md is None else md.strftime("%Y-%m-%d"),
            "modelRate": None if mrate is None else round(float(mrate), 4), "modelStatus": status,
            "vsArrivalInr": usd * (rate - arrival),
            "vsModelInr": None if mrate is None else usd * (rate - float(mrate)),
        })
    return out


def actuals_summary(rows):
    if not rows:
        return None
    vm = [x["vsModelInr"] for x in rows if x["vsModelInr"] is not None]
    return {"count": len(rows), "vsArrivalInr": sum(x["vsArrivalInr"] for x in rows), "vsModelInr": sum(vm) if vm else None}


@app.get("/api/dashboard")
def dashboard(refresh: bool = False):
    df = rates(refresh)
    raw = read_csv()
    assumed = raw.empty
    history = model.load_receipts(None) if assumed else model.load_receipts(CSV)  # performance history
    open_r = raw[raw.status == "open"][["date", "amount"]].copy()  # live signals: real, still-open only
    open_r["date"] = pd.to_datetime(open_r["date"])
    payload = model.build_payload(df, history, DEMO, assumed, open_receipts=open_r)
    payload["actuals"] = actuals(df, raw)
    payload["actualsSummary"] = actuals_summary(payload["actuals"])
    conv = raw[raw.status == "converted"]
    opn = raw[raw.status == "open"]
    payload["portfolio"] = {
        "totalUsd": float(raw.amount.sum()),
        "convertedUsd": float(conv.amount.sum()),
        "inrReceived": float((conv.amount * conv.convertedRate.astype(float)).sum()),
        "openUsd": float(opn.amount.sum()),
        "openCount": int(len(opn)),
        "convertedCount": int(len(conv)),
    }
    return payload


@app.get("/api/remittances")
def list_remittances():
    return [{"id": int(i), "date": str(r.date)[:10], "amount": float(r.amount), "status": r.status,
             "convertedDate": None if nn(r.convertedDate) is None else str(r.convertedDate)[:10],
             "convertedRate": None if nn(r.convertedRate) is None else float(r.convertedRate)}
            for i, r in read_csv().iterrows()]


@app.post("/api/remittances")
def add_remittance(r: Remittance):
    row = {"date": r.date.isoformat(), "amount": r.amount, "status": "open", "convertedDate": None, "convertedRate": None}
    write_csv(pd.concat([read_csv(), pd.DataFrame([row])], ignore_index=True))
    return list_remittances()


def _get(rid):
    df = read_csv()
    if rid not in df.index:
        raise HTTPException(404, "Remittance not found")
    return df


@app.patch("/api/remittances/{rid}/convert")
def convert(rid: int, c: Conversion):
    df = _get(rid)
    df.loc[rid, "status"] = "converted"
    df.loc[rid, "convertedDate"] = c.date.isoformat()
    df.loc[rid, "convertedRate"] = c.rate
    write_csv(df)
    return list_remittances()


@app.patch("/api/remittances/{rid}/reopen")
def reopen(rid: int):
    df = _get(rid)
    df.loc[rid, "status"] = "open"
    df.loc[rid, "convertedDate"] = None
    df.loc[rid, "convertedRate"] = None
    write_csv(df)
    return list_remittances()


@app.delete("/api/remittances/{rid}")
def delete_remittance(rid: int):
    write_csv(_get(rid).drop(index=rid))
    return list_remittances()


@app.get("/api/rate")
def rate_on(date: Date):
    """Latest published rate on or before the given date (weekends and holidays use the previous day)."""
    df = rates()
    sub = df.loc[df.index <= pd.Timestamp(date)]
    if sub.empty:
        raise HTTPException(404, "No rate available on or before that date")
    return {"requestedDate": date.isoformat(), "rateDate": sub.index[-1].strftime("%Y-%m-%d"),
            "rate": round(float(sub["rate"].iloc[-1]), 4)}