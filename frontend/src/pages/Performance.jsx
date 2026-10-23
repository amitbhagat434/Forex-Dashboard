import LineChart from '../components/LineChart.jsx'
import { Kpi, Table } from '../components/Ui.jsx'
import { f2, sg, inr, usd } from '../format.js'

export default function Performance({ data }) {
  const { kpi: k, cumulative: c, tranches: tr, actuals = [], actualsSummary: a } = data
  const spot = data.today.spot
  const received = actuals.reduce((s, x) => s + x.usd * x.actualRate, 0)
  const atToday = actuals.reduce((s, x) => s + x.usd * spot, 0)
  const convertedUsd = actuals.reduce((s, x) => s + x.usd, 0)
  const mine = actuals.length > 0 && (
    <div className="card">
      <h3>Your actual conversions vs the model</h3>
      <div className="kpis">
        <Kpi label="Conversions recorded" value={a.count} />
        <Kpi label="Gain vs arrival rate" value={inr(a.vsArrivalInr)} tone={a.vsArrivalInr >= 0 ? 'up' : 'dn'} />
        <Kpi label="Gain vs model rule" value={a.vsModelInr == null ? 'Pending' : inr(a.vsModelInr)} tone={a.vsModelInr >= 0 ? 'up' : 'dn'} />
        <Kpi label="Total converted (USD)" value={usd(convertedUsd)} />
        <Kpi label="Total converted value (INR)" value={inr(received)} />
        <Kpi label={`Same USD at today's rate (${f2(spot)})`} value={inr(atToday)} />
        <Kpi label="Gain vs today's rate" value={inr(received - atToday)} tone={received - atToday >= 0 ? 'up' : 'dn'} />
      </div>
      <Table head={['Received', 'USD', 'Arrival', 'You converted', 'Model', 'Vs arrival', 'Vs model', 'Received (INR)', "At today's rate (INR)", 'Model (INR)']}
        rows={actuals.map((x) => [x.remitDate, usd(x.usd), f2(x.arrivalRate), `${x.actualDate} at ${f2(x.actualRate)}`,
          x.modelRate ? `${x.modelDate} at ${f2(x.modelRate)}${x.modelStatus === 'Forced at deadline' ? ' (forced)' : ''}` : x.modelStatus,
          <span className={x.vsArrivalInr >= 0 ? 'up' : 'dn'}>{inr(x.vsArrivalInr)}</span>,
          x.vsModelInr == null ? '-' : <span className={x.vsModelInr >= 0 ? 'up' : 'dn'}>{inr(x.vsModelInr)}</span>,
          inr(x.usd * x.actualRate), inr(x.usd * spot), x.modelRate ? inr(x.usd * x.modelRate) : '-'])} />
    </div>
  )

  if (!k.tranches) return <>{mine}<div className="card">No completed tranches yet. Backtest results appear once a remittance's 30-day window has ended.</div></>
  const max = Math.max(...tr.map((t) => Math.abs(t.pnlPct))) || 1, w = 480 / tr.length
  return (
    <>
      <div className="top"><h2>Performance</h2>
        <span className="mut">{k.tranches} completed tranches, ${(k.usdVolume / 1e6).toFixed(1)}M converted</span></div>
      {data.assumedSchedule && <div className="card note">Based on an assumed $100,000 monthly schedule until real remittances are added.</div>}
            {mine}
      <div className="kpis">
        <Kpi label="Win rate" value={`${k.winRate}%`} />
        <Kpi label="Loss rate" value={`${k.lossRate}%`} />
        <Kpi label="Net added value" value={inr(k.netAddedInr)} tone={k.netAddedInr >= 0 ? 'up' : 'dn'} />
        <Kpi label="Cumulative outperformance" value={`${sg(k.cumOutperfPct, 3)}%`} />
        <Kpi label="Avg gain (winners)" value={`${sg(k.avgGainPct)}%`} />
        <Kpi label="Avg loss (losers)" value={`${k.avgLossPct}%`} />
        <Kpi label="Forced at deadline" value={`${k.forcedRate}%`} />
        <Kpi label="Capture of best possible" value={`${k.captureRatio}%`} />
      </div>
      <div className="g2">
        <div className="card"><h3>Cumulative added value (INR)</h3>
          <LineChart label="Cumulative profit" decimals={0} series={[{ values: c.profitInr, color: 'var(--teal)' }]}
            labels={[[0, c.dates[0].slice(0, 4)], [c.dates.length - 1, c.dates.at(-1).slice(0, 4)]]} /></div>
        <div className="card"><h3>Gain or loss per tranche (%)</h3>
          <svg viewBox="0 0 500 160" width="100%" role="img" aria-label="Gain or loss per tranche">
            <line x1="10" x2="490" y1="80" y2="80" stroke="var(--line)" />
            {tr.map((t, i) => (
              <rect key={i} x={10 + i * w} width={Math.max(w - 1, 1)} height={(Math.abs(t.pnlPct) / max) * 66}
                y={t.pnlPct >= 0 ? 80 - (t.pnlPct / max) * 66 : 80} fill={t.pnlPct >= 0 ? 'var(--ok)' : 'var(--bad)'} />
            ))}
          </svg></div>
      </div>
      <div className="card">
        <h3>Tranche log (latest 25)</h3>
        <Table head={['Received', 'USD', 'Arrival', 'Executed', 'Rate', 'Days', 'Best rate', 'P/L INR', 'P/L %']}
          rows={[...tr].reverse().slice(0, 25).map((t) => [t.remitDate, usd(t.usd), f2(t.arrivalSpot),
            t.execDate + (t.forced ? ' (forced)' : ''), f2(t.execRate), t.daysHeld, f2(t.bestRate),
            <span className={t.profitInr >= 0 ? 'up' : 'dn'}>{inr(t.profitInr)}</span>, sg(t.pnlPct)])} />
        <p className="mut small">Best rate is hindsight and not achievable in practice.</p>
      </div>
    </>
  )
}
