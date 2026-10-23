import LineChart from '../components/LineChart.jsx'
import { Kpi, Pill, Legend, Table } from '../components/Ui.jsx'
import { f2, sg, usd } from '../format.js'

export default function Signals({ data }) {
  const { today: t, openTranches: open, chart } = data
  const chg = (t.spot / t.prevSpot - 1) * 100
  const toConvert = open.filter((o) => o.action === 'Convert').length
  return (
    <>
      <div className="top">
        <div><span className="mut">USD/INR {t.date} </span><span className="px">{f2(t.spot)}</span>{' '}
          <span className={chg >= 0 ? 'up' : 'dn'}>{sg(chg)}%</span></div>
      </div>
      <div className="kpis">
        <Kpi label="Spot" value={f2(t.spot)} />
        <Kpi label="16-day average" value={t.sma16 ? f2(t.sma16) : '-'} />
        <Kpi label="Spot vs average" value={`${sg(t.gapPct ?? 0)}%`} tone={(t.gapPct ?? 0) >= 0 ? 'up' : 'dn'} />
        <Kpi label="Open remittances" value={`${open.length} (${toConvert} to convert)`} />
      </div>
      <div className="card">
        <h3>Open remittances: today's action</h3>
        {open.length === 0 ? (
          <p className="mut">No remittances in their 30-day window. Add one under Remittances.</p>
        ) : (
          <Table head={['Received', 'USD', 'Arrival rate', 'Days left', 'Action', 'Why']}
            rows={open.map((o) => [o.remitDate, usd(o.usd), f2(o.arrivalRate), o.daysLeft, <Pill action={o.action} />, o.reason])} />
        )}
      </div>
      <div className="card">
        <h3>Spot vs 16-day average, last 90 days</h3>
        <Legend items={[['var(--teal)', 'Spot'], ['var(--amber)', '16-day average']]} />
        <LineChart label="Spot against 16-day average"
          series={[{ values: chart.spot, color: 'var(--teal)' }, { values: chart.sma16, color: 'var(--amber)', dashed: true }]}
          labels={[[0, chart.dates[0]], [chart.dates.length - 1, chart.dates.at(-1)]]}
          dot={{ index: chart.dates.length - 1, color: t.aboveSma ? 'var(--ok)' : 'var(--bad)' }} />
        <p className="mut small">Rule: convert when spot is at or above the 16-day average and above the arrival rate. Otherwise convert at the 30-day deadline.</p>
      </div>
    </>
  )
}
