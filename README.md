# USD/INR Conversion Desk (React + Python)

The strategy stays in Python (`backend/model.py`). FastAPI exposes it as JSON; React only displays it.

## Run it
Terminal 1 (API):
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000        # add FX_DEMO=1 for offline synthetic rates

Terminal 2 (UI):
    cd frontend
    npm install
    npm run dev                                  # http://localhost:5173

## API
GET /api/dashboard?refresh=true   signals, KPIs, charts, tranche log
GET/POST /api/remittances         saved to backend/remittances.csv
DELETE /api/remittances/{id}

## Notes
- Rates come from FRED (DEXINUS) and are cached for 1 hour.
- With no saved remittances, performance assumes $100,000 on the 1st of each month since Jun 2016.
- To change the strategy, edit constants and run_rule() in backend/model.py. The UI needs no changes.
- Market triggers (sentiment, forwards) are placeholders until their data sources exist.
